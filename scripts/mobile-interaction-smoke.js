const { chromium } = require('C:/Users/aline/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const baseUrl = process.env.LM_BASE_URL || 'http://localhost:3100';
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const user = {
      username: 'auditoria-interacao',
      name: 'auditoria-interacao',
      fullName: 'Auditoria de Interação',
      avatar: 'bertha',
      isAdmin: false,
      progress: {
        tutorialCompleted: true,
        notebookIntroduced: true,
        unlockedPhases: Array.from({ length: 12 }, (_, index) => index + 1),
        completedPhases: [],
        collectedEvidence: [],
        answers: [],
        fieldNotes: {},
        badges: []
      }
    };
    localStorage.setItem('lm_storage_version', 'supabase-session-20260818a');
    localStorage.setItem('lm_users', JSON.stringify({ 'auditoria-interacao': user }));
    localStorage.setItem('lm_currentUser', JSON.stringify(user));
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GameLogic?.phaseContent?.chapters?.length);
  await page.evaluate(() => GameLogic.dismissDialogueLayer?.());

  const checks = {};

  await page.locator('#menuBtn').click();
  checks.menuOpened = await page.locator('#fullMenu').evaluate((element) => element.classList.contains('active'));
  await page.keyboard.press('Escape');
  checks.menuClosedWithEscape = await page.locator('#fullMenu').evaluate((element) => !element.classList.contains('active'));

  await page.keyboard.press('c');
  await page.waitForTimeout(80);
  checks.notebookOpenedWithC = await page.locator('#notebookOverlay').evaluate((element) => element.classList.contains('active'));
  await page.keyboard.press('Escape');
  checks.notebookClosedWithEscape = await page.locator('#notebookOverlay').evaluate((element) => !element.classList.contains('active'));
  await page.waitForTimeout(420);

  await page.locator('#inventoryBtn').click();
  await page.waitForTimeout(80);
  checks.inventoryOpened = await page.locator('#inventoryOverlay').evaluate((element) => element.classList.contains('active'));
  checks.notebookStayedClosed = await page.locator('#notebookOverlay').evaluate((element) => !element.classList.contains('active'));
  await page.keyboard.press('Escape');
  checks.inventoryClosedWithEscape = await page.locator('#inventoryOverlay').evaluate((element) => !element.classList.contains('active'));
  await page.waitForTimeout(420);

  await page.keyboard.press('1');
  await page.waitForTimeout(120);
  checks.numberShortcutOpenedPhase = await page.locator('#investigationModal').count() === 1;
  const beforeScroll = await page.locator('.investigation-dossier').evaluate((element) => element.scrollTop);
  await page.locator('.investigation-dossier').focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(140);
  const afterScroll = await page.locator('.investigation-dossier').evaluate((element) => element.scrollTop);
  checks.arrowKeyScrollsDossier = afterScroll > beforeScroll;
  await page.keyboard.press('Escape');
  checks.phaseClosedWithEscape = await page.locator('#investigationModal').count() === 0;

  const failed = Object.entries(checks).filter(([, passed]) => !passed);
  console.log(JSON.stringify({ checks, errors, failed }, null, 2));
  await browser.close();
  if (failed.length || errors.length) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
