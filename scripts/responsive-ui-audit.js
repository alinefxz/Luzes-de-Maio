const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/aline/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const baseUrl = process.env.LM_BASE_URL || 'http://127.0.0.1:3001';
const output = path.resolve(__dirname, '..', 'mobile-audit', 'responsive-ui');
fs.mkdirSync(output, { recursive: true });

const devices = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'notebook', width: 1366, height: 768 }
];

function userFixture() {
  return {
    username: 'auditoria-responsiva',
    name: 'auditoria-responsiva',
    fullName: 'Auditoria Responsiva',
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

async function inspectActiveLayer(page, selector) {
  return page.locator(selector).evaluate((layer) => {
    const rect = layer.getBoundingClientRect();
    const descendants = Array.from(layer.querySelectorAll('*')).filter((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 2 && box.height > 2 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const overflow = descendants.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.split(/\s+/).slice(0, 3).join('.') : '',
        left: Math.round(box.left),
        right: Math.round(box.right)
      };
    }).filter((item) => item.left < -4 || item.right > innerWidth + 4)
      .filter((item) => !/timeline|ending-backdrop/.test(item.className));

    return {
      rect: [rect.left, rect.top, rect.width, rect.height].map(Math.round),
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      layerOverflow: Math.max(0, layer.scrollWidth - layer.clientWidth),
      horizontal: overflow.slice(0, 12)
    };
  });
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
    }, userFixture());
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
      GameLogic.saveGameProgress = async () => true;
    });

    const checks = {};

    await page.locator('#menuBtn').click();
    await page.waitForTimeout(450);
    checks.menu = await inspectActiveLayer(page, '#fullMenu');
    await page.screenshot({ path: path.join(output, `${device.name}-menu.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    checks.menuClosed = await page.locator('#fullMenu').evaluate(element => !element.classList.contains('active'));

    await page.evaluate(() => GameLogic.openNotebook());
    await page.waitForTimeout(550);
    checks.notebook = await inspectActiveLayer(page, '#notebookOverlay');
    await page.screenshot({ path: path.join(output, `${device.name}-notebook.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(550);
    checks.notebookClosed = await page.locator('#notebookOverlay').evaluate(element => !element.classList.contains('active'));

    await page.evaluate(() => GameLogic.openInventoryPanel());
    await page.waitForTimeout(650);
    checks.inventory = await inspectActiveLayer(page, '#inventoryOverlay');
    await page.screenshot({ path: path.join(output, `${device.name}-inventory.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(550);
    checks.inventoryClosed = await page.locator('#inventoryOverlay').evaluate(element => !element.classList.contains('active'));

    await page.evaluate(() => GameLogic.openProfileModal(true));
    await page.waitForTimeout(450);
    checks.profile = await inspectActiveLayer(page, '#modalOverlay');
    await page.screenshot({ path: path.join(output, `${device.name}-profile.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    checks.profileClosed = await page.locator('#modalOverlay').evaluate(element => !element.classList.contains('active'));

    await page.evaluate(() => {
      GameLogic.progress.unlockedPhases = Array.from({ length: GameLogic.getPhaseList().length + 1 }, (_, index) => index + 1);
      GameLogic.restoreGameState();
      GameLogic.openModal('review');
    });
    await page.waitForTimeout(650);
    checks.review = await inspectActiveLayer(page, '#modalOverlay');
    await page.screenshot({ path: path.join(output, `${device.name}-review.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    checks.reviewClosed = await page.locator('#modalOverlay').evaluate(element => !element.classList.contains('active'));
    checks.errors = errors;
    report[device.name] = checks;
    await context.close();
  }

  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const failures = Object.entries(report).flatMap(([device, checks]) => {
    const layers = ['menu', 'notebook', 'inventory', 'profile', 'review'];
    return [
      ...layers.filter(name => checks[name].documentOverflow || checks[name].layerOverflow || checks[name].horizontal.length)
        .map(name => `${device}:${name}:overflow`),
      ...['menuClosed', 'notebookClosed', 'inventoryClosed', 'profileClosed', 'reviewClosed']
        .filter(name => !checks[name]).map(name => `${device}:${name}`),
      ...checks.errors.map(error => `${device}:page:${error}`)
    ];
  });
  console.log(JSON.stringify({ report, failures }, null, 2));
  await browser.close();
  if(failures.length) process.exit(1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
