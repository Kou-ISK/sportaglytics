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
let app;
let phase = 'first launch';
let launchTrace;
const onboardingComplete = () =>
  localStorage.getItem('sportaglytics-onboarding-completed') === 'true';
const launch = async () => {
  const trace = { events: [], stderr: [] };
  launchTrace = trace;
  const record = (list, value) => {
    if (list.length >= 16) list.shift();
    list.push(value);
  };
  const application = await electron.launch({
    ...getElectronLaunchOptions(
      path.join(work, 'profile'),
      process.platform === 'linux' && process.env.E2E_CLOUD_LINUX === '1'
        ? ['--no-sandbox', '--disable-gpu']
        : [],
    ),
    timeout: 60000,
  });
  trace.child = application.process();
  trace.child?.stderr?.on('data', (buffer) => {
    // Preserve only diagnostic categories, never raw paths, tokens or content.
    const rules = [
      ['crash', /crashpad|crash report|segmentation fault|fatal/i],
      ['navigation', /navigation|execution context.*destroyed/i],
      [
        'child process',
        /resource temporarily unavailable|posix_spawn|failed to launch|sandbox/i,
      ],
      ['graphics', /GPU process.*(crash|exit)|AppleM2ScalerParavirtDriver/i],
      ['signing', /code signature|library validation|notari[sz]/i],
    ];
    const message = String(buffer).slice(0, 4096);
    for (const [kind, matches] of rules) {
      if (matches.test(message)) record(trace.stderr, kind);
    }
  });
  const watched = new WeakSet();
  const watch = (page) => {
    if (watched.has(page)) return;
    watched.add(page);
    page.setDefaultTimeout(30000);
    for (const event of ['close', 'crash', 'domcontentloaded', 'load']) {
      page.on(event, () => record(trace.events, event));
    }
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame())
        record(trace.events, 'main-frame navigation');
    });
  };
  application.on('window', watch);
  application.windows().forEach(watch);
  return application;
};
const childExited = (child) =>
  !!child && (child.exitCode !== null || child.signalCode !== null);
const openSample = async (firstRun) => {
  assert.ok(
    !childExited(launchTrace?.child),
    'Electron exited before opening sample',
  );
  const main = await app.firstWindow();
  const skip = main.getByRole('button', { name: 'スキップ', exact: true });
  if (firstRun) {
    await skip.click();
    await skip.waitFor({ state: 'hidden' });
  }
  await main.waitForFunction(onboardingComplete);
  assert.equal(await skip.isVisible(), false, 'tutorial should stay dismissed');
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
  const firstOpen = await openSample(true);
  const { main } = firstOpen;
  let { timeline } = firstOpen;
  const original = timeline.getByTestId(
    'timeline-instance-synthetic-first-tag',
  );
  const review = main.getByText('映像レビュー 1 / 1', { exact: true });
  const isWatching = () => {
    const video = document.querySelector('#video_0_html5_api');
    return (
      video instanceof HTMLVideoElement &&
      video.currentTime > 2 &&
      video.currentTime < 5 &&
      !video.paused
    );
  };
  await original.dblclick();
  await review.waitFor();
  await main.waitForFunction(isWatching);
  assert.equal(
    await timeline.getByRole('dialog', { name: 'アクション編集' }).count(),
    0,
  );
  await review.waitFor({ state: 'hidden', timeout: 8000 });
  await main.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return (
      video instanceof HTMLVideoElement &&
      video.paused &&
      video.currentTime >= 4.9 &&
      video.currentTime < 5.65
    );
  });
  await timeline
    .getByRole('button', { name: '練習 / パス 行', exact: true })
    .dblclick();
  await review.waitFor();
  await main.waitForFunction(isWatching);
  await main.getByRole('button', { name: 'レビューを終了' }).click();
  await review.waitFor({ state: 'hidden' });
  console.log(
    'Instance and row double-click play bounded review without opening the edit dialog',
  );
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
  await timeline
    .getByTestId(`timeline-instance-${copy.id}`)
    .click({ button: 'right' });
  await timeline.getByRole('menuitem', { name: '編集', exact: true }).click();
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
  phase = 'reopen';
  app = await launch();
  ({ timeline } = await openSample(false));
  await timeline
    .getByTestId(`timeline-instance-${copy.id}`)
    .click({ button: 'right' });
  await timeline.getByRole('menuitem', { name: '編集', exact: true }).click();
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
} catch (error) {
  console.error(
    'Synthetic first run diagnostics',
    JSON.stringify({
      phase,
      exitCode: launchTrace?.child?.exitCode ?? null,
      signal: launchTrace?.child?.signalCode ?? null,
      pageEvents: launchTrace?.events ?? [],
      stderrCategories: launchTrace?.stderr ?? [],
    }),
  );
  // Do not use Main evaluation after a crash/disconnect. Cleanup may itself
  // fail; retain the original assertion/launch error rather than replace it.
  if (app && !childExited(launchTrace?.child)) {
    let deadline;
    try {
      await Promise.race([
        app.close().catch(() => {}),
        new Promise((resolve) => {
          deadline = setTimeout(resolve, 2000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
      const child = launchTrace?.child;
      // This is solely the child spawned for this disposable synthetic profile.
      if (child && !childExited(child)) child.kill('SIGKILL');
    }
  }
  app = undefined;
  throw error;
} finally {
  if (app) await closeAfterSave();
  await fs.rm(work, { recursive: true, force: true });
}
