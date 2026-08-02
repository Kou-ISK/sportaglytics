import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const repositoryPath = path.resolve(import.meta.dirname, '..');
const workPath = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-code-window-menu-e2e-'),
);
const profilePath = path.join(workPath, 'profile');
const codeWindowPath = path.join(workPath, 'Empty Code Window.stcw');
const codeWindowSaveAsPath = path.join(workPath, 'Renamed Code Window.stcw');
const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...electronEnvironment } =
  process.env;

const electronApp = await electron.launch({
  executablePath: electronPath,
  args: [repositoryPath, `--user-data-dir=${profilePath}`],
  env: {
    ...electronEnvironment,
    NODE_ENV: 'test',
  },
});

const clickCreateCodeWindowMenuItem = async () => {
  await electronApp.evaluate(async ({ Menu }) => {
    const deadline = Date.now() + 10_000;
    let menuItem =
      Menu.getApplicationMenu()?.getMenuItemById('create-code-window');
    while (!menuItem && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      menuItem =
        Menu.getApplicationMenu()?.getMenuItemById('create-code-window');
    }
    if (!menuItem) {
      throw new Error('The create code window menu item was not found.');
    }
    menuItem.click();
  });
};

try {
  const mainPage = await electronApp.firstWindow();
  await mainPage.evaluate(() => {
    localStorage.setItem('sportaglytics-onboarding-completed', 'true');
  });
  await mainPage.reload();
  await mainPage.getByText('新規パッケージ', { exact: true }).waitFor({
    timeout: 10_000,
  });
  await electronApp.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, codeWindowPath);

  const codeWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await clickCreateCodeWindowMenuItem();
  const codeWindowPage = await codeWindowPromise;
  await codeWindowPage.waitForLoadState('domcontentloaded');
  await codeWindowPage
    .getByText('Empty Code Window', { exact: true })
    .waitFor({ state: 'visible', timeout: 10_000 });

  assert.equal(new URL(codeWindowPage.url()).hash, '#/coding-panel');
  const savedDocument = JSON.parse(await fs.readFile(codeWindowPath, 'utf-8'));
  assert.equal(savedDocument.version, 1);
  assert.equal(savedDocument.layout.name, 'Empty Code Window');
  assert.deepEqual(savedDocument.layout.buttons, []);
  assert.equal(
    electronApp.windows().some((page) => page.url().endsWith('#/settings')),
    false,
  );

  await codeWindowPage.getByRole('button', { name: '編集' }).click();
  await codeWindowPage
    .getByRole('button', { name: '保存', exact: true })
    .waitFor({ state: 'visible' });
  await electronApp.evaluate(({ dialog }, filePath) => {
    globalThis.__codeWindowSaveDialogCount = 0;
    dialog.showSaveDialog = async () => {
      globalThis.__codeWindowSaveDialogCount += 1;
      return { canceled: false, filePath };
    };
  }, codeWindowSaveAsPath);
  await codeWindowPage.getByRole('button', { name: '別名保存' }).click();
  await codeWindowPage.waitForTimeout(300);
  const saveAsDialogCount = await electronApp.evaluate(
    () => globalThis.__codeWindowSaveDialogCount,
  );
  assert.equal(
    saveAsDialogCount,
    1,
    'Save As must open exactly one native file dialog',
  );
  const renamedDocument = JSON.parse(
    await fs.readFile(codeWindowSaveAsPath, 'utf-8'),
  );
  assert.equal(renamedDocument.version, 1);
  const emptyStateColor = await codeWindowPage
    .getByText('空白を右クリック → ボタンを追加')
    .evaluate((element) => getComputedStyle(element).color);
  assert.equal(emptyStateColor, 'rgba(0, 0, 0, 0.38)');

  const settingsWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await mainPage.evaluate(() => window.electronAPI.openSettingsWindow());
  const settingsPage = await settingsWindowPromise;
  await settingsPage.waitForLoadState('domcontentloaded');
  await settingsPage.getByText('一般', { exact: true }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });
  assert.equal(
    await settingsPage.getByText('設定の読み込みに失敗しました').count(),
    0,
    'the settings sub-window must load through the sandboxed preload bundle',
  );
  assert.equal(
    await settingsPage.evaluate(() => typeof window.electronAPI.loadSettings),
    'function',
  );

  const screenshotPath = process.env.E2E_SCREENSHOT_PATH;
  if (screenshotPath) {
    await codeWindowPage.screenshot({ path: screenshotPath });
  }
  const screenshotDirectory = process.env.E2E_SCREENSHOT_DIR;
  if (screenshotDirectory) {
    await fs.mkdir(screenshotDirectory, { recursive: true });
    await codeWindowPage.screenshot({
      path: path.join(screenshotDirectory, 'code-window-loaded.png'),
    });
    await settingsPage.screenshot({
      path: path.join(screenshotDirectory, 'settings-window-loaded.png'),
    });
  }
  console.log('Code window menu E2E passed');
} finally {
  await electronApp.close().catch(() => undefined);
}
