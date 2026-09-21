import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';
import { exercisePlaylistSorter } from './e2e-playlist-sorter.mjs';

const dir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-export-menu-'),
);
const packagePath = path.join(dir, 'menu-test.stpkg');
const output = path.join(dir, 'output');
await fs.mkdir(output);
await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
await fs.mkdir(path.join(packagePath, 'videos'));
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=blue:s=320x180:r=25:d=4',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  path.join(packagePath, 'videos/video.mp4'),
]);
await fs.writeFile(
  path.join(packagePath, '.metadata/config.json'),
  JSON.stringify({
    team1Name: 'Red',
    team2Name: 'Blue',
    primaryAngleId: 'angle-1',
    angles: [
      {
        id: 'angle-1',
        name: 'Angle 1',
        sourceKind: 'local',
        relativePath: 'videos/video.mp4',
      },
    ],
  }),
);
await fs.writeFile(
  path.join(packagePath, 'timeline.json'),
  JSON.stringify({
    version: 2,
    rows: [{ id: 'attack', name: 'Attack', color: '#ff5500' }],
    instances: [
      {
        id: 'one',
        actionName: 'Attack',
        startTime: 0.5,
        endTime: 2.5,
        memo: '',
      },
    ],
  }),
);
const app = await electron.launch(
  getElectronLaunchOptions(path.join(dir, 'profile')),
);

const clickExportMenu = async (page) => {
  const id = await (
    await app.browserWindow(page)
  ).evaluate((window) => window.id);
  // Invoke the real Electron MenuItem callback, with the same owner as an OS menu click.
  await app.evaluate(({ Menu, BrowserWindow }, windowId) => {
    const menu = Menu.getApplicationMenu();
    const findExport = (items) => {
      for (const item of items) {
        if (item.label === '映像クリップ（オーバーレイ付き）') return item;
        const nested = item.submenu && findExport(item.submenu.items);
        if (nested) return nested;
      }
    };
    const item = menu && findExport(menu.items);
    if (!item) throw new Error('Video export menu missing');
    const owner = BrowserWindow.fromId(windowId);
    owner.focus();
    item.click(undefined, owner);
  }, id);
};
const exportDialog = (page) =>
  page.getByRole('dialog').filter({ hasText: 'クリップ書き出し' });

try {
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await app.evaluate(({ dialog }) => {
    globalThis.__exportMenuNotices = [];
    dialog.showMessageBox = async (...args) => {
      globalThis.__exportMenuNotices.push(args.at(-1).message);
      return { response: 0, checkboxChecked: false };
    };
  });
  await main.getByText('新しいパッケージを作成', { exact: true }).waitFor();
  await clickExportMenu(main);
  assert.deepEqual(await app.evaluate(() => globalThis.__exportMenuNotices), [
    '書き出すパッケージまたはプレイリストを開いてください。',
  ]);
  const timelinePromise = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, pkg) => {
    BrowserWindow.getAllWindows()[0].webContents.send(
      'open-package-directory',
      pkg,
    );
  }, packagePath);
  let timeline = await timelinePromise;
  await timeline
    .getByRole('button', { name: 'Attack 行', exact: true })
    .waitFor({ timeout: 30000 });
  await main.locator('#video_0_html5_api').waitFor();

  await clickExportMenu(main);
  await exportDialog(timeline).waitFor({ timeout: 5000 });
  assert.equal(await exportDialog(main).count(), 0);
  await exportDialog(timeline)
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();
  console.log('Video window menu routes to Timeline export');

  // Reopening must wait for the new renderer's data and export subscription.
  const closed = timeline.waitForEvent('close');
  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.close());
  await closed;
  const reopened = app.waitForEvent('window');
  await clickExportMenu(main);
  timeline = await reopened;
  await exportDialog(timeline).waitFor({ timeout: 15000 });
  await exportDialog(timeline)
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();
  // Consumed requests must not reopen a dialog on a later ordinary window open.
  const closedAgain = timeline.waitForEvent('close');
  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.close());
  await closedAgain;
  const ordinaryOpen = app.waitForEvent('window');
  await main.evaluate(() => window.electronAPI.timelineWindow.openWindow());
  timeline = await ordinaryOpen;
  await timeline
    .getByRole('button', { name: 'Attack 行', exact: true })
    .waitFor();
  assert.equal(await exportDialog(timeline).count(), 0);
  console.log('Closed Timeline export and consumed-request lifecycle passed');

  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.minimize());
  await clickExportMenu(main);
  await exportDialog(timeline).waitFor();
  assert.equal(
    await (
      await app.browserWindow(timeline)
    ).evaluate((window) => window.isMinimized()),
    false,
  );
  await exportDialog(timeline)
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();

  await clickExportMenu(timeline);
  await exportDialog(timeline).waitFor();
  assert.ok(
    await exportDialog(timeline)
      .getByRole('button', { name: '書き出し', exact: true })
      .evaluate(
        (button) => button.getBoundingClientRect().bottom <= window.innerHeight,
      ),
    'export actions must fit the short Timeline window',
  );
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await timeline.screenshot({
      path: path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'export-menu-timeline.png',
      ),
    });
  }
  await exportDialog(timeline)
    .getByLabel('ファイル名（連結時）/ プレフィックス')
    .fill('menu-export');
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, output);
  assert.equal(
    await exportDialog(timeline)
      .getByRole('button', { name: '書き出し', exact: true })
      .isDisabled(),
    true,
  );
  await exportDialog(timeline)
    .getByRole('radio', { name: '含める', exact: true })
    .check();
  const progressPromise = app.waitForEvent('window');
  await exportDialog(timeline)
    .getByRole('button', { name: '書き出し', exact: true })
    .click();
  const progress = await progressPromise;
  await progress
    .getByText('書き出し完了', { exact: true })
    .waitFor({ timeout: 60000 });
  const files = (await fs.readdir(output)).filter((name) =>
    name.endsWith('.mp4'),
  );
  assert.equal(files.length, 1);
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
        path.join(output, files[0]),
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(Math.abs(Number(probe.format.duration) - 2) < 0.2);
  assert.ok(
    probe.streams.some(
      (stream) => stream.codec_type === 'video' && stream.width === 320,
    ),
  );
  console.log(
    'Native menu -> export dialog -> destination -> FFmpeg output passed',
  );

  const playlistPath = path.join(dir, 'review.stpl');
  await fs.mkdir(playlistPath);
  await fs.writeFile(
    path.join(playlistPath, 'playlist.json'),
    JSON.stringify({
      id: 'review',
      name: 'Export review',
      type: 'reference',
      createdAt: 1,
      updatedAt: 1,
      items: [
        {
          id: 'review-one',
          timelineItemId: 'one',
          actionName: 'Review',
          startTime: 1,
          endTime: 2,
          addedAt: 1,
          videoSource: path.join(packagePath, 'videos/video.mp4'),
        },
      ],
    }),
  );
  const reviewPromise = app.waitForEvent('window');
  await main.evaluate(
    (folder) => window.electronAPI.playlist.loadPlaylistFile(folder),
    playlistPath,
  );
  const review = await reviewPromise;
  await review.getByTestId('organizer-clip-review-one').waitFor();
  await clickExportMenu(review);
  const playlistDialog = review
    .getByRole('dialog')
    .filter({ hasText: 'プレイリストを書き出し' });
  await playlistDialog.waitFor();
  assert.equal(
    await exportDialog(timeline).count(),
    0,
    'Playlist menu must not open Timeline export',
  );
  await playlistDialog
    .getByLabel('ファイル名 (拡張子不要)')
    .fill('playlist-menu');
  const oldProgressClosed = progress.waitForEvent('close');
  await (
    await app.browserWindow(progress)
  ).evaluate((window) => window.close());
  await oldProgressClosed;
  assert.equal(
    await playlistDialog
      .getByRole('button', { name: '書き出す', exact: true })
      .isDisabled(),
    true,
  );
  await playlistDialog
    .getByRole('radio', { name: '含める', exact: true })
    .check();
  const playlistProgressPromise = app.waitForEvent('window');
  await playlistDialog
    .getByRole('button', { name: '書き出す', exact: true })
    .click();
  const playlistProgress = await playlistProgressPromise;
  await playlistProgress
    .getByText('書き出し完了', { exact: true })
    .waitFor({ timeout: 60000 });
  const playlistFiles = (await fs.readdir(output)).filter(
    (name) => name.startsWith('playlist-menu') && name.endsWith('.mp4'),
  );
  assert.equal(playlistFiles.length, 1);
  const duration = Number(
    execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        path.join(output, playlistFiles[0]),
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(
    Math.abs(duration - 1) < 0.2,
    'Playlist export must use its own clip range',
  );
  console.log('Playlist native menu -> its own dialog -> FFmpeg output passed');
  await exercisePlaylistSorter({ app, main, dir, output, clickExportMenu });
} finally {
  await app.close().catch(() => undefined);
  await fs.rm(dir, { recursive: true, force: true });
}
