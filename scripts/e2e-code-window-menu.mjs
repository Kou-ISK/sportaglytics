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
const selectedCodeWindowPath = path.join(workPath, 'Selected Code Window.stcw');
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

const clickMenuItem = async (menuItemId) => {
  await electronApp.evaluate(async ({ Menu }, id) => {
    const deadline = Date.now() + 10_000;
    let menuItem = Menu.getApplicationMenu()?.getMenuItemById(id);
    while (!menuItem && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      menuItem = Menu.getApplicationMenu()?.getMenuItemById(id);
    }
    if (!menuItem) {
      throw new Error(`The ${id} menu item was not found.`);
    }
    menuItem.click();
  }, menuItemId);
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

  const menuSnapshot = await electronApp.evaluate(({ Menu }) => {
    const applicationMenu = Menu.getApplicationMenu();
    const fileMenu = applicationMenu?.items.find(
      (item) => item.label === 'ファイル',
    );
    const codingMenu = applicationMenu?.items.find(
      (item) => item.label === 'コーディング',
    );
    const windowMenu = applicationMenu?.items.find(
      (item) => item.label === 'ウィンドウ',
    );
    return {
      topLevelLabels: applicationMenu?.items.map((item) => item.label) ?? [],
      fileLabels: fileMenu?.submenu?.items.map((item) => item.label) ?? [],
      hasCodingMenu: Boolean(codingMenu),
      windowLabels: windowMenu?.submenu?.items.map((item) => item.label) ?? [],
    };
  });
  assert.deepEqual(menuSnapshot.fileLabels.slice(0, 3), [
    '新規',
    '開く',
    '最近開いた映像パッケージ',
  ]);
  assert.equal(menuSnapshot.hasCodingMenu, false);
  assert.equal(menuSnapshot.topLevelLabels.includes('コーディング'), false);
  assert.equal(
    menuSnapshot.windowLabels.includes('コードウィンドウを開く'),
    false,
  );
  console.log('Menu structure assertions passed');

  await clickMenuItem('create-video-package');
  await mainPage
    .getByRole('heading', { name: '新規パッケージ' })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await mainPage.keyboard.press('Escape');
  console.log('New package menu flow passed');

  await electronApp.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, codeWindowPath);

  const codeWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await clickMenuItem('create-code-window');
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
  console.log('Code window create and save flow passed');

  await fs.writeFile(
    selectedCodeWindowPath,
    JSON.stringify({
      version: 1,
      layout: {
        id: 'selected-code-window',
        name: 'Selected Code Window',
        canvasWidth: 800,
        canvasHeight: 600,
        buttons: [
          {
            id: 'test-action',
            type: 'action',
            name: 'Test Action',
            x: 42,
            y: 38,
            width: 156,
            height: 58,
            color: '#0a84ff',
            textColor: '#ffffff',
            fontSize: 17,
            textAlign: 'left',
            borderRadius: 7,
            hotkey: 'T',
            showHotkey: true,
          },
        ],
      },
    }),
    'utf-8',
  );
  await electronApp.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
  }, selectedCodeWindowPath);
  await clickMenuItem('open-code-window-file');
  await codeWindowPage
    .getByText('Selected Code Window', { exact: true })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await codeWindowPage.getByRole('button', { name: 'コード' }).click();
  const runtimeButton = codeWindowPage.locator(
    '[data-code-window-button="test-action"]',
  );
  await runtimeButton.waitFor({ state: 'visible' });
  const runtimeAppearance = await runtimeButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: style.left,
      top: style.top,
      width: style.width,
      height: style.height,
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      fontSize: style.fontSize,
      justifyContent: style.justifyContent,
    };
  });
  await codeWindowPage.getByRole('button', { name: '編集' }).click();
  const editorButton = codeWindowPage.locator(
    '[data-code-window-button="test-action"]',
  );
  await editorButton.waitFor({ state: 'visible' });
  const editorAppearance = await editorButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: style.left,
      top: style.top,
      width: style.width,
      height: style.height,
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      fontSize: style.fontSize,
      justifyContent: style.justifyContent,
    };
  });
  assert.deepEqual(editorAppearance, runtimeAppearance);
  await codeWindowPage.waitForTimeout(200);
  const unchangedDocument = JSON.parse(
    await fs.readFile(selectedCodeWindowPath, 'utf-8'),
  );
  assert.equal(unchangedDocument.layout.canvasWidth, 800);
  assert.equal(unchangedDocument.layout.canvasHeight, 600);
  console.log('Code window file selection flow passed');

  const settingsWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await mainPage.evaluate(() => window.electronAPI.openSettingsWindow());
  const settingsPage = await settingsWindowPromise;
  await settingsPage.waitForLoadState('domcontentloaded');
  await settingsPage.getByRole('tab', { name: '一般' }).waitFor({
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
  assert.equal(
    await settingsPage.getByRole('button', { name: '変更を保存' }).isDisabled(),
    true,
  );
  await settingsPage.getByRole('tab', { name: 'ホットキー' }).click();
  const hotkeySearch = settingsPage.getByLabel('ホットキーを検索');
  await hotkeySearch.fill('再生');
  assert.ok(
    (await settingsPage
      .getByRole('list', { name: 'ホットキー一覧' })
      .getByRole('listitem')
      .count()) > 0,
  );
  await hotkeySearch.fill('存在しない操作');
  await settingsPage.getByText('一致するホットキーはありません。').waitFor();
  await settingsPage.setViewportSize({ width: 640, height: 560 });
  assert.equal(
    await settingsPage.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
  );
  console.log('Settings window preload flow passed');

  const helpWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await clickMenuItem('open-help');
  const helpPage = await helpWindowPromise;
  await helpPage.waitForLoadState('domcontentloaded');
  const helpSearch = helpPage.getByLabel('ヘルプを検索');
  await helpSearch.waitFor({ state: 'visible' });
  await helpSearch.fill('同期');
  assert.ok(await helpPage.locator('.nav-item:not([hidden])').count());
  await helpSearch.fill('一致しない検索語');
  await helpPage.getByText('一致する項目はありません').waitFor();
  await helpSearch.press('Escape');
  await helpPage.getByRole('heading', { name: 'パッケージ管理' }).waitFor();
  await helpPage.setViewportSize({ width: 640, height: 520 });
  assert.equal(
    await helpPage.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
  );
  console.log('Searchable help window flow passed');

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
    await helpPage.screenshot({
      path: path.join(screenshotDirectory, 'help-window-loaded.png'),
    });
  }
  console.log('Code window menu E2E passed');
} finally {
  await electronApp.close().catch(() => undefined);
}
