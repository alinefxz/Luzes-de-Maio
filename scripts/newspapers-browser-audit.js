const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/aline/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const baseUrl = process.env.LM_BASE_URL || 'http://127.0.0.1:3000';
const output = path.resolve(__dirname, '..', 'mobile-audit', 'newspapers');
fs.mkdirSync(output, { recursive: true });

const devices = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'notebook', width: 1366, height: 768 }
];

const files = [
  '10-01-1932.pdf', '21-02-1932.pdf', '09-08-1932.pdf', '25-08-1932.pdf',
  '09-10-1932.pdf', '16-10-1932.pdf', '06-11-1932.pdf', '22-01-1933.pdf',
  '09-04-1933.pdf', '16-04-1933.pdf', '23-04-1933.pdf', '07-05-1933.pdf',
  '28-05-1933.pdf'
];

function fixture() {
  return {
    username: 'auditoria-jornais',
    name: 'auditoria-jornais',
    fullName: 'Auditoria dos Jornais',
    avatar: 'bertha',
    isAdmin: false,
    progress: {
      tutorialCompleted: true,
      notebookIntroduced: true,
      unlockedPhases: [1],
      completedPhases: [],
      answers: [],
      collectedEvidence: [],
      fieldNotes: { general: '' },
      badges: []
    }
  };
}

async function geometry(page, selector) {
  return page.locator(selector).evaluate((element) => ({
    documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    elementOverflow: Math.max(0, element.scrollWidth - element.clientWidth),
    width: Math.round(element.getBoundingClientRect().width),
    viewport: innerWidth
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const report = {};

  for(const device of devices) {
    const context = await browser.newContext({ viewport: device });
    await context.addInitScript((user) => {
      localStorage.setItem('lm_storage_version', 'supabase-session-20260818a');
      localStorage.setItem('lm_users', JSON.stringify({ [user.username]: user }));
      localStorage.setItem('lm_currentUser', JSON.stringify(user));
    }, fixture());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.GameLogic?.phaseContent?.chapters?.length === 3);
    await page.evaluate(() => {
      document.getElementById('finalLetterOverlay')?.remove();
      document.getElementById('finalThanksScreen')?.remove();
      document.getElementById('chapterTimelineOverlay')?.remove();
      document.getElementById('phaseIntroOverlay')?.remove();
      document.getElementById('investigationModal')?.remove();
      document.querySelectorAll('.source-reader-overlay, .profile-decision-layer').forEach(element => element.remove());
      GameLogic.dismissDialogueLayer?.();
      GameLogic.closeAllModals?.();
    });

    await page.evaluate(() => GameLogic.openModal('about'));
    await page.waitForTimeout(300);
    const about = await geometry(page, '#modal-about');
    const aboutText = await page.locator('#modal-about').innerText();
    const aboutOnTop = await page.evaluate(() => {
      const element = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return Boolean(element?.closest('#modalOverlay'));
    });
    await page.screenshot({ path: path.join(output, `${device.name}-about.png`), fullPage: false });
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      if(document.getElementById('modalOverlay')?.classList.contains('active')) {
        GameLogic.closeTopLayer?.();
      }
    });

    await page.locator('#menuBtn').click();
    await page.getByRole('button', { name: 'Jornais', exact: true }).click();
    await page.waitForTimeout(450);
    const newspapers = await geometry(page, '#modal-newspapers');
    const records = await page.locator('.newspaper-record').count();
    await page.locator('.newspaper-record-select').last().click();
    await page.waitForTimeout(300);
    const selectedTitle = await page.locator('#newspaperViewerTitle').innerText();
    const viewerSource = await page.locator('#newspaperViewer').getAttribute('src');
    await page.screenshot({ path: path.join(output, `${device.name}-newspapers.png`), fullPage: false });
    await page.keyboard.press('Escape');
    const closed = await page.locator('#modalOverlay').evaluate(element => !element.classList.contains('active'));

    report[device.name] = {
      about,
      aboutComplete: aboutText.includes('Todo arquivo guarda uma história') && aboutText.includes('Aline Fernanda de Oliveira'),
      aboutOnTop,
      newspapers,
      records,
      selectedTitle,
      viewerSource,
      closed,
      errors
    };
    await context.close();
  }

  const pdfContext = await browser.newContext();
  const pdfChecks = {};
  for(const file of files) {
    const response = await pdfContext.request.get(`${baseUrl}/assets/jornais/${file}`);
    const body = await response.body();
    pdfChecks[file] = {
      status: response.status(),
      contentType: response.headers()['content-type'] || '',
      signature: body.subarray(0, 5).toString('ascii')
    };
  }
  await pdfContext.close();
  report.pdfChecks = pdfChecks;

  const failures = [];
  for(const [device, result] of Object.entries(report).filter(([key]) => key !== 'pdfChecks')) {
    if(result.about.documentOverflow || result.about.elementOverflow) failures.push(`${device}:about-overflow`);
    if(result.newspapers.documentOverflow || result.newspapers.elementOverflow) failures.push(`${device}:newspapers-overflow`);
    if(!result.aboutComplete) failures.push(`${device}:about-incomplete`);
    if(!result.aboutOnTop) failures.push(`${device}:about-layer`);
    if(result.records !== 13) failures.push(`${device}:records-${result.records}`);
    if(!result.selectedTitle.includes('Edição 175')) failures.push(`${device}:selection-title`);
    if(!result.viewerSource.includes('28-05-1933.pdf')) failures.push(`${device}:viewer-source`);
    if(!result.closed) failures.push(`${device}:escape`);
    result.errors.forEach(error => failures.push(`${device}:page:${error}`));
  }
  for(const [file, result] of Object.entries(pdfChecks)) {
    if(result.status !== 200 || result.signature !== '%PDF-' || !result.contentType.includes('application/pdf')) {
      failures.push(`${file}:${JSON.stringify(result)}`);
    }
  }

  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report, failures }, null, 2));
  await browser.close();
  if(failures.length) process.exit(1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
