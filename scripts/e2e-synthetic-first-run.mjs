import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { primaryModifier } from './e2e-platform.mjs';
import { ffprobePath } from './media-tool-paths.mjs';

const work = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-first-run-'),
);
const packagePath = path.join(work, 'Synthetic-first-run.stpkg');
const output = path.join(work, 'exports');
await fs.mkdir(output);
execFileSync(process.env.PYTHON ?? 'python3', [
  '-m',
  'zipfile',
  '-e',
  'samples/synthetic-first-run.stpkg.zip',
  work,
]);
const launch = () =>
  electron.launch(
    getElectronLaunchOptions(
      path.join(work, 'profile'),
      process.platform === 'linux' && process.env.E2E_CLOUD_LINUX === '1'
        ? ['--no-sandbox', '--disable-gpu']
        : [],
    ),
  );
let app;
const openSample = async () => {
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, packagePath);
  await main
    .getByRole('button', { name: 'パッケージを開く', exact: true })
    .click();
  const deadline = Date.now() + 15000;
  let timeline;
  while (!timeline && Date.now() < deadline) {
    timeline = app
      .windows()
      .find((page) => new URL(page.url()).hash === '#/timeline');
    if (!timeline) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(timeline, 'sample must open its Timeline window');
  await timeline
    .getByRole('button', { name: '練習 / メモ 行', exact: true })
    .waitFor();
  await main.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return (
      video instanceof HTMLVideoElement &&
      video.readyState >= 2 &&
      Math.abs(video.duration - 20) < 0.1
    );
  });
  return { main, timeline };
};
const waitForSaved = async (predicate) => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const document = JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    );
    if (predicate(document)) return document;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Synthetic edits were not persisted');
};
const closeAfterSave = async () => {
  // This exercise explicitly waits for disk persistence; shutdown races belong to the save-protection suite.
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
  });
  await app.close().catch(() => {});
};
try {
  app = await launch();
  let { timeline } = await openSample();
  await timeline.getByTestId('timeline-instance-synthetic-first-tag').click();
  await timeline.keyboard.press(`${primaryModifier}+c`);
  await timeline
    .getByRole('button', { name: '練習 / メモ 行', exact: true })
    .click();
  await timeline.keyboard.press(`${primaryModifier}+v`);
  const withCopy = await waitForSaved(
    (document) => document.instances.length === 2,
  );
  const copy = withCopy.instances.find(
    (item) => item.id !== 'synthetic-first-tag',
  );
  assert.equal(copy.actionName, '練習 / メモ');
  await timeline.getByTestId(`timeline-instance-${copy.id}`).dblclick();
  const edit = timeline.getByRole('dialog');
  await edit.getByLabel('開始秒').fill('6');
  await edit.getByLabel('終了秒').fill('9');
  await edit
    .getByRole('textbox', { name: 'ノート', exact: true })
    .fill('はじめての練習');
  await edit.getByRole('button', { name: '保存', exact: true }).click();
  const saved = await waitForSaved((document) =>
    document.instances.some(
      (item) =>
        item.id === copy.id &&
        item.memo === 'はじめての練習' &&
        item.startTime === 6 &&
        item.endTime === 9,
    ),
  );
  assert.equal(saved.instances.length, 2);
  await closeAfterSave();
  app = await launch();
  ({ timeline } = await openSample());
  await timeline.getByTestId(`timeline-instance-${copy.id}`).dblclick();
  assert.equal(
    await timeline.getByRole('dialog').getByLabel('開始秒').inputValue(),
    '6',
  );
  assert.equal(
    await timeline
      .getByRole('dialog')
      .getByRole('textbox', { name: 'ノート', exact: true })
      .inputValue(),
    'はじめての練習',
  );
  await timeline
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();
  await timeline.getByTestId(`timeline-instance-${copy.id}`).click();
  const owner = await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.id);
  await app.evaluate(
    ({ Menu, BrowserWindow, dialog }, { owner, output }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [output],
      });
      const find = (items) => {
        for (const item of items) {
          if (item.label === '映像クリップ（オーバーレイ付き）') return item;
          const result = item.submenu && find(item.submenu.items);
          if (result) return result;
        }
      };
      const command = find(Menu.getApplicationMenu().items);
      if (!command) throw new Error('Export command missing');
      command.click(command, BrowserWindow.fromId(owner));
    },
    { owner, output },
  );
  const dialog = timeline
    .getByRole('dialog')
    .filter({ hasText: 'クリップ書き出し' });
  await dialog
    .getByRole('radio', { name: '選択インスタンス (1 件)', exact: true })
    .check();
  await dialog.getByRole('radio', { name: '含めない', exact: true }).check();
  await dialog
    .getByLabel('ファイル名（連結時）/ プレフィックス')
    .fill('first-clip');
  const progressOpened = app.waitForEvent('window');
  await dialog.getByRole('button', { name: '書き出し', exact: true }).click();
  const progress = await progressOpened;
  await progress
    .getByText('書き出し完了', { exact: true })
    .waitFor({ timeout: 60000 });
  const videos = (await fs.readdir(output)).filter((name) =>
    name.endsWith('.mp4'),
  );
  assert.equal(videos.length, 1);
  const probe = JSON.parse(
    execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        path.join(output, videos[0]),
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(Math.abs(Number(probe.format.duration) - 3) < 0.2);
  assert.ok(
    probe.streams.some(
      (stream) => stream.codec_type === 'video' && stream.width === 640,
    ),
  );
  console.log(
    'Public sample: open, native decode, copy tag, edit, disk save, fresh-process reopen, selected 3-second MP4 export passed',
  );
} finally {
  if (app) await closeAfterSave();
  await fs.rm(work, { recursive: true, force: true });
}
