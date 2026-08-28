const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/aline/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const baseUrl = process.env.LM_BASE_URL || 'http://127.0.0.1:3001';
const output = path.resolve(__dirname, '..', 'mobile-audit', 'full-player');
fs.mkdirSync(output, { recursive: true });

const viewports = [
  { name: 'mobile', width: 390, height: 844, fullJourney: true },
  { name: 'tablet', width: 768, height: 1024, fullJourney: false },
  { name: 'notebook', width: 1366, height: 768, fullJourney: false }
];

function userFixture() {
  return {
    username: 'jogadora_teste',
    name: 'jogadora_teste',
    fullName: 'Jogadora de Teste',
    avatar: 'bertha',
    isAdmin: false,
    progress: {
      tutorialCompleted: true,
      notebookIntroduced: true,
      unlockedPhases: [1],
      phaseRecords: {},
      answers: [],
      collectedEvidence: [],
      fieldNotes: { general: '' },
      badges: [],
      gameEvents: []
    }
  };
}

async function prepareGame(page) {
  await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GameLogic?.phaseContent?.chapters?.length === 3);
  await page.evaluate(() => {
    document.getElementById('finalLetterOverlay')?.remove();
    document.getElementById('finalThanksScreen')?.remove();
    document.getElementById('chapterTimelineOverlay')?.remove();
    GameLogic.dismissDialogueLayer?.();
    GameLogic.closeAllModals?.();
    GameLogic.saveGameProgress = async () => true;
  });
}

async function openPhase(page, phaseNum) {
  await page.evaluate((number) => {
    document.getElementById('investigationModal')?.remove();
    document.getElementById('chapterTimelineOverlay')?.remove();
    GameLogic.dismissDialogueLayer?.();
    GameLogic.openPhaseDossier(GameLogic.getPhases()[number]);
  }, phaseNum);
  await page.waitForSelector('#investigationModal .activity-area');
}

async function answerPhase(page, phaseNum, correct) {
  return page.evaluate(({ phaseNum: number, correct: shouldBeCorrect }) => {
    const data = GameLogic.getPhases()[number];
    const root = document.getElementById('investigationModal');
    if(!data || !root) throw new Error(`Fase ${number} nao foi aberta.`);

    const click = (selector, scope = root) => {
      const element = scope.querySelector(selector);
      if(!element) throw new Error(`Fase ${number}: controle ausente: ${selector}`);
      element.click();
      return element;
    };
    const escaped = (value) => CSS.escape(String(value));
    const wrongIndex = (correctIndex, total) => (Number(correctIndex) + 1) % total;
    const rotate = (items) => items.length > 1 ? [...items.slice(1), items[0]] : items;

    const answerRounds = (items) => {
      items.forEach((item, index) => {
        const options = item.options || data.categories || [];
        const optionIndex = shouldBeCorrect
          ? item.correctIndex
          : wrongIndex(item.correctIndex, options.length);
        click(`[data-round-option="${optionIndex}"]`);
        if(index < items.length - 1) click('[data-round-next]');
      });
    };

    const answerAssociations = (items, answerKey = 'answer', targetKey = 'id') => {
      const expected = items.map(item => item[answerKey]);
      const values = shouldBeCorrect ? expected : rotate(expected);
      items.forEach((item, index) => {
        click(`[data-assoc-token="${escaped(values[index])}"]`);
        click(`[data-assoc-drop="${escaped(item[targetKey])}"]`);
      });
    };

    switch(data.mode) {
      case 'chronology':
      case 'rightsStack': {
        const order = shouldBeCorrect ? data.correctOrder : rotate(data.correctOrder);
        order.forEach((id, index) => {
          click(`[data-order-id="${escaped(id)}"]`);
          click(`[data-slot-index="${index}"]`);
        });
        break;
      }
      case 'quoteMatch': {
        answerAssociations(data.quotes);
        if(data.closingQuestion) {
          const index = shouldBeCorrect
            ? data.closingQuestion.correctIndex
            : wrongIndex(data.closingQuestion.correctIndex, data.closingQuestion.options.length);
          click(`[data-quiz-index="${index}"]`);
        }
        break;
      }
      case 'connections': {
        answerAssociations(data.pairs);
        if(data.closingQuestion) {
          const index = shouldBeCorrect
            ? data.closingQuestion.correctIndex
            : wrongIndex(data.closingQuestion.correctIndex, data.closingQuestion.options.length);
          click(`[data-quiz-index="${index}"]`);
        }
        break;
      }
      case 'tripleEvidence': {
        const conclusions = data.matches.map(item => item.conclusion);
        const limits = data.matches.map(item => item.limit);
        const chosenConclusions = shouldBeCorrect ? conclusions : rotate(conclusions);
        const chosenLimits = shouldBeCorrect ? limits : rotate(limits);
        data.matches.forEach((item, index) => {
          click(`[data-assoc-token="${escaped(chosenConclusions[index])}"]`);
          click(`[data-assoc-drop="${escaped(`conclusion:${item.id}`)}"]`);
          click(`[data-assoc-token="${escaped(chosenLimits[index])}"]`);
          click(`[data-assoc-drop="${escaped(`limit:${item.id}`)}"]`);
        });
        const closingIndex = shouldBeCorrect
          ? data.closingQuestion.correctIndex
          : wrongIndex(data.closingQuestion.correctIndex, data.closingQuestion.options.length);
        click(`[data-quiz-index="${closingIndex}"]`);
        break;
      }
      case 'restoreText':
      case 'restoreInvestigation': {
        const expected = data.blanks.map(blank => blank.answer);
        const values = shouldBeCorrect ? expected : rotate(expected);
        data.blanks.forEach((blank, index) => {
          click(`[data-word="${escaped(values[index])}"]`);
          click(`[data-blank-id="${escaped(blank.id)}"]`);
        });
        if(data.rounds) answerRounds(data.rounds);
        break;
      }
      case 'multiRoundQuiz':
      case 'interviewBooth':
        answerRounds(data.mode === 'interviewBooth' ? data.interviews : data.rounds);
        break;
      case 'headlineInvestigation':
      case 'headlineOrder': {
        const order = shouldBeCorrect ? data.correctOrder : rotate(data.correctOrder);
        order.forEach(word => click(`[data-word="${escaped(word)}"]`));
        if(data.rounds) answerRounds(data.rounds);
        break;
      }
      case 'factOpinion':
      case 'classificationCabinet':
      case 'dossierDetector': {
        if(data.mode === 'dossierDetector') {
          click('[data-open-source]');
          root.querySelector('.source-reader-close')?.click();
        }
        data.statements.forEach(item => {
          const options = data.categories.map(category => category.id);
          const value = shouldBeCorrect
            ? item.answer
            : options.find(option => option !== item.answer);
          const card = root.querySelector(`[data-statement-id="${escaped(item.id)}"]`);
          click(`[data-value="${escaped(value)}"]`, card);
        });
        break;
      }
      case 'highlight': {
        const wanted = shouldBeCorrect
          ? data.snippets.filter(item => item.important)
          : [data.snippets.find(item => !item.important) || data.snippets[0]];
        wanted.forEach(item => click(`[data-highlight-id="${escaped(item.id)}"]`));
        break;
      }
      case 'highlightComparison': {
        const marks = Array.from(root.querySelectorAll('.mark-token'));
        const wanted = shouldBeCorrect
          ? marks.filter(button => button.dataset.answer === 'true')
          : [marks.find(button => button.dataset.answer !== 'true') || marks[0]];
        wanted.forEach(button => button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
        answerRounds(data.rounds);
        break;
      }
      case 'layeredMagnifier': {
        data.magnifierZones.forEach((zone, index) => {
          const paper = root.querySelector(`[data-worn-zone="${escaped(zone.id)}"]`);
          paper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          if(index < data.magnifierZones.length - 1) click('[data-zone-next]');
        });
        answerRounds(data.rounds);
        break;
      }
      case 'evidenceReview': {
        data.reviewRounds.forEach(round => {
          const optionIds = round.options.map(option => option.id);
          let chosen = [...round.correct];
          if(!shouldBeCorrect) {
            const alternatives = optionIds.filter(id => !round.correct.includes(id));
            chosen = [...alternatives, ...round.correct].slice(0, round.required);
          }
          const section = root.querySelector(`[data-review-round="${escaped(round.id)}"]`);
          chosen.forEach(id => click(`[data-review-option="${escaped(id)}"]`, section));
        });
        const expected = data.evidenceMap.map(item => item.answer);
        const values = shouldBeCorrect ? expected : rotate(expected);
        data.evidenceMap.forEach((item, index) => {
          click(`[data-assoc-token="${escaped(values[index])}"]`);
          click(`[data-assoc-drop="${escaped(item.id)}"]`);
        });
        break;
      }
      case 'finalDossier': {
        const thesis = shouldBeCorrect
          ? data.correctThesis
          : data.thesisOptions.find(item => item.id !== data.correctThesis).id;
        click(`[data-thesis="${escaped(thesis)}"]`);
        data.evidenceBank.filter(item => item.relevant).slice(0, 2)
          .forEach(item => click(`[data-final-evidence="${escaped(item.id)}"]`));
        click(`[data-limitation="${escaped(data.limitations[0].id)}"]`);
        const conclusion = root.querySelector('[data-final-conclusion]');
        conclusion.value = 'A mobilizacao anterior a 1932 levou o direito nacional as urnas de Muzambinho em 1933, mas o jornal nao quantifica as mulheres e revela limites e desigualdades.';
        conclusion.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
      default: {
        if(!Array.isArray(data.options)) throw new Error(`Fase ${number}: modo sem automacao: ${data.mode}`);
        const index = shouldBeCorrect
          ? data.correctIndex
          : wrongIndex(data.correctIndex, data.options.length);
        click(`[data-quiz-index="${index}"]`);
      }
    }

    click('[data-submit-activity]');
    return { mode: data.mode, title: data.title, revealCount: data.revealDates?.length || 0 };
  }, { phaseNum, correct });
}

async function inspectLayout(page, label) {
  return page.evaluate((auditLabel) => {
    const viewportWidth = window.innerWidth;
    const dossier = document.querySelector('.investigation-dossier');
    const visible = Array.from(document.querySelectorAll('body *')).filter(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const insideInactiveLayer = element.closest([
        '.inventory-overlay:not(.active)',
        '.notebook-overlay:not(.active)',
        '.full-menu:not(.active)',
        '.modal-overlay:not(.active)'
      ].join(','));
      return !insideInactiveLayer && rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const horizontal = visible.filter(element => !element.closest('.timeline-strip, .timeline-scroller, .ending-backdrop-details')).map(element => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || '',
        className: typeof element.className === 'string' ? element.className.split(/\s+/).slice(0, 3).join('.') : '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width)
      };
    }).filter(item => item.left < -4 || item.right > viewportWidth + 4)
      .filter(item => !item.className.includes('timeline-track'))
      .slice(0, 30);

    const clippedText = visible.filter(element => {
      if(!element.textContent.trim()) return false;
      const style = getComputedStyle(element);
      const hiddenX = ['hidden', 'clip'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 4;
      const hiddenY = ['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 4;
      return hiddenX || hiddenY;
    }).map(element => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className.split(/\s+/).slice(0, 3).join('.') : '',
      text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
      client: [element.clientWidth, element.clientHeight],
      scroll: [element.scrollWidth, element.scrollHeight]
    })).filter(item => !/badge-name|source-reader-content|inventory-overlay|investigation-overlay|ending-backdrop-details/.test(item.className)).slice(0, 30);

    const smallTargets = visible.filter(element => element.matches('button, a, input, textarea, select, [role="button"]'))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          className: typeof element.className === 'string' ? element.className.split(/\s+/).slice(0, 2).join('.') : '',
          size: [Math.round(rect.width), Math.round(rect.height)]
        };
      })
      .filter(item => item.size[0] < 40 || item.size[1] < 40)
      .filter(item => !/mark-token|phase-reset-text/.test(item.className))
      .slice(0, 30);

    return {
      label: auditLabel,
      viewport: [window.innerWidth, window.innerHeight],
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - viewportWidth),
      dossier: dossier ? {
        clientWidth: dossier.clientWidth,
        scrollWidth: dossier.scrollWidth,
        clientHeight: dossier.clientHeight,
        scrollHeight: dossier.scrollHeight
      } : null,
      horizontal,
      clippedText,
      smallTargets
    };
  }, label);
}

async function inspectHome(page, viewportName) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.locator('.dossier-card').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, `${viewportName}-home-dossier.png`) });
  return page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null;
    };
    const overlaps = (a, b) => Boolean(a && b && Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top));
    const clipping = rect('.dossier-card .clipping');
    const photo = rect('.dossier-card .polaroid');
    const stamp = rect('.dossier-card .interactive-stamp');
    const card = rect('.dossier-card');
    return {
      viewport: [window.innerWidth, window.innerHeight],
      card: card && [Math.round(card.width), Math.round(card.height)],
      clippingPhotoOverlap: overlaps(clipping, photo),
      photoStampOverlap: overlaps(photo, stamp),
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth)
    };
  });
}

async function testDrag(page) {
  await openPhase(page, 2);
  const phase2 = await page.evaluate(() => GameLogic.getPhases()[2]);
  const chronologyTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(`[data-order-id="${phase2.correctOrder[0]}"]`).dispatchEvent('dragstart', { dataTransfer: chronologyTransfer });
  await page.locator('[data-slot-index="0"]').dispatchEvent('dragover', { dataTransfer: chronologyTransfer });
  await page.locator('[data-slot-index="0"]').dispatchEvent('drop', { dataTransfer: chronologyTransfer });
  const chronologyFilled = await page.locator('[data-slot-index="0"]').evaluate(element => Boolean(element.dataset.value));

  await openPhase(page, 3);
  const mapping = await page.evaluate(() => {
    const phase = GameLogic.getPhases()[3];
    return { token: phase.quotes[0].answer, target: phase.quotes[0].id };
  });
  const associationTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(`[data-assoc-token="${mapping.token}"]`).dispatchEvent('dragstart', { dataTransfer: associationTransfer });
  await page.locator(`[data-assoc-drop="${mapping.target}"]`).dispatchEvent('dragover', { dataTransfer: associationTransfer });
  await page.locator(`[data-assoc-drop="${mapping.target}"]`).dispatchEvent('drop', { dataTransfer: associationTransfer });
  const associationFilled = await page.locator(`[data-assoc-drop="${mapping.target}"]`).evaluate(element => element.classList.contains('assoc-filled'));
  await page.evaluate(() => document.getElementById('investigationModal')?.remove());
  return { chronologyFilled, associationFilled };
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const report = { baseUrl, homes: {}, phases: [], deviceSweeps: {}, drag: null, errors: [] };

  for(const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((fixture) => {
      localStorage.setItem('lm_currentUser', JSON.stringify(fixture));
    }, userFixture());
    const page = await context.newPage();
    page.on('console', message => {
      if(message.type() === 'error') report.errors.push(`${viewport.name}: console: ${message.text()}`);
    });
    page.on('pageerror', error => report.errors.push(`${viewport.name}: page: ${error.message}`));

    report.homes[viewport.name] = await inspectHome(page, viewport.name);
    await prepareGame(page);

    const chapterHeader = await page.evaluate(() => {
      GameLogic.progress.unlockedPhases = Array.from({ length: 28 }, (_, index) => index + 1);
      GameLogic.currentChapterIndex = 2;
      GameLogic.restoreGameState();
      const kicker = document.querySelector('.chapter-kicker');
      const label = document.querySelector('.cabinet-label');
      const a = kicker.getBoundingClientRect();
      const b = label.getBoundingClientRect();
      return {
        text: kicker.innerText.trim(),
        visible: a.width > 0 && a.height > 0,
        overlap: Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
      };
    });

    if(viewport.fullJourney) {
      await page.evaluate(() => {
        GameLogic.progress.unlockedPhases = [1];
        GameLogic.progress.phaseRecords = {};
        GameLogic.progress.answers = [];
        GameLogic.progress.collectedEvidence = [];
        GameLogic.progress.gameEvents = [];
        GameLogic.currentChapterIndex = 0;
        GameLogic.restoreGameState();
      });

      report.drag = await testDrag(page);

      for(let phaseNum = 1; phaseNum <= 27; phaseNum += 1) {
        await openPhase(page, phaseNum);
        const layout = await inspectLayout(page, `mobile:phase-${phaseNum}`);
        if([1, 3, 6, 11, 18, 20, 24, 27].includes(phaseNum)) {
          await page.locator('.phase-activity-page').evaluate(element => element.scrollIntoView({ block: 'start' }));
          await page.screenshot({ path: path.join(output, `mobile-phase-${String(phaseNum).padStart(2, '0')}.png`) });
        }

        const beforeAnswers = await page.evaluate(() => GameLogic.progress.answers?.length || 0);
        const wrongMeta = await answerPhase(page, phaseNum, false);
        await page.waitForSelector('#investigationModal .stamp-wrong', { timeout: 2500 });
        const afterWrong = await page.evaluate(() => GameLogic.progress.answers?.length || 0);
        const wrongHelp = await page.locator('#npcOverlay .npc-text').textContent().catch(() => '');
        if(afterWrong !== beforeAnswers) throw new Error(`Fase ${phaseNum}: erro registrou conclusao indevidamente.`);

        await openPhase(page, phaseNum);
        const correctMeta = await answerPhase(page, phaseNum, true);
        await page.waitForFunction((number) => GameLogic.progress.answers?.some(answer => answer.phaseNum === number && answer.isCorrect), phaseNum, { timeout: 3000 });
        const unlocked = await page.evaluate((number) => GameLogic.progress.unlockedPhases.includes(number + 1), phaseNum);
        if(!unlocked) throw new Error(`Fase ${phaseNum}: a proxima fase nao foi liberada.`);
        const revealDelay = correctMeta.revealCount ? 850 + (correctMeta.revealCount * 260) : 1100;
        await page.waitForTimeout(revealDelay);
        await page.evaluate(() => GameLogic.dismissDialogueLayer?.());

        report.phases.push({
          phase: phaseNum,
          title: correctMeta.title,
          mode: correctMeta.mode,
          wrongFeedbackShown: Boolean(wrongHelp?.trim()),
          unlocked,
          layout
        });
      }

      await page.evaluate(() => GameLogic.showChapterTimeline(2, null));
      await page.waitForSelector('#chapterTimelineOverlay[data-final-ending="true"]');
      const finalTimelineCount = await page.locator('.chapter-timeline-entry').count();
      await page.screenshot({ path: path.join(output, 'mobile-final-timeline.png') });
      await page.evaluate(() => GameLogic.closeChapterTimeline());
      await page.waitForSelector('#finalLetterOverlay', { timeout: 2500 });
      const finalLetterVisible = await page.locator('#finalLetterOverlay').isVisible();
      await page.screenshot({ path: path.join(output, 'mobile-final-letter.png') });
      await page.locator('.final-letter-continue').click();
      await page.waitForSelector('#finalThanksScreen.active', { timeout: 2500 });
      const finalThanksVisible = await page.locator('#finalThanksScreen').isVisible();
      await page.screenshot({ path: path.join(output, 'mobile-final-thanks.png') });
      await page.locator('.final-review-link').click();
      await page.waitForSelector('#modalOverlay.active #modal-review.active', { timeout: 2500 });
      await page.waitForTimeout(650);
      const reviewOpened = await page.locator('#modal-review').isVisible();
      await page.screenshot({ path: path.join(output, 'mobile-final-review.png') });
      report.ending = { finalTimelineCount, finalLetterVisible, finalThanksVisible, reviewOpened };
    } else {
      const sweep = [];
      for(let phaseNum = 1; phaseNum <= 27; phaseNum += 1) {
        await openPhase(page, phaseNum);
        sweep.push(await inspectLayout(page, `${viewport.name}:phase-${phaseNum}`));
      }
      report.deviceSweeps[viewport.name] = { chapterHeader, phases: sweep };
    }

    report.deviceSweeps[viewport.name] = report.deviceSweeps[viewport.name] || {};
    report.deviceSweeps[viewport.name].chapterHeader = chapterHeader;
    await context.close();
  }

  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const summary = {
    homes: report.homes,
    completedPhases: report.phases.length,
    phaseFailures: report.phases.filter(item => !item.wrongFeedbackShown || !item.unlocked).map(item => item.phase),
    layoutFailures: report.phases.filter(item => item.layout.documentOverflow || item.layout.horizontal.length || item.layout.clippedText.length).map(item => ({
      phase: item.phase,
      overflow: item.layout.documentOverflow,
      horizontal: item.layout.horizontal.length,
      clipped: item.layout.clippedText.length
    })),
    tabletFailures: (report.deviceSweeps.tablet?.phases || []).filter(item => item.documentOverflow || item.horizontal.length || item.clippedText.length).length,
    notebookFailures: (report.deviceSweeps.notebook?.phases || []).filter(item => item.documentOverflow || item.horizontal.length || item.clippedText.length).length,
    drag: report.drag,
    ending: report.ending,
    errors: report.errors
  };
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
