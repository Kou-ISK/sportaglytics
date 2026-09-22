import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'playlist-angles-'));
const pkg = path.join(root, 'sample.stpkg');
const playlist = path.join(root, 'review.stpl');
const output = path.join(root, 'output');
await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
await fs.mkdir(playlist);
await fs.mkdir(output);
const sources = ['blue', 'green', 'yellow', 'red'];
for (const [index, color] of sources.entries()) {
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=640x360:r=25:d=6`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${index < 2 ? 440 : 880}:sample_rate=48000:duration=6`,
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    path.join(pkg, `${color}.mp4`),
  ]);
}
await fs.writeFile(
  path.join(pkg, '.metadata/config.json'),
  JSON.stringify({
    primaryAngleId: 'one',
    angles: [
      ['blue', 'green'],
      ['yellow', 'red'],
    ].map((colors, index) => ({
      id: index ? 'two' : 'one',
      name: `Angle ${index + 1}`,
      sourceKind: 'local',
      relativePath: `${colors[0]}.mp4`,
      clips: colors.map((color, position) => ({
        id: color,
        sourceKind: 'local',
        relativePath: `${color}.mp4`,
        durationSeconds: 6,
        timelineStartSeconds: position * 6,
      })),
    })),
  }),
);
await fs.writeFile(path.join(pkg, 'timeline.json'), JSON.stringify([]));
await fs.writeFile(
  path.join(playlist, 'playlist.json'),
  JSON.stringify({
    id: 'review',
    name: 'Angle review',
    type: 'reference',
    createdAt: 1,
    updatedAt: 1,
    items: ['first', 'second'].map((id, index) => ({
      id,
      timelineItemId: null,
      actionName: `Review ${index + 1}`,
      startTime: index ? 7 : 1,
      endTime: index ? 9 : 3,
      addedAt: 1,
      videoSource: path.join(pkg, 'blue.mp4'),
      videoSource2: path.join(pkg, 'yellow.mp4'),
      note: index ? 'Second angle' : 'First angle',
    })),
  }),
);
const app = await electron.launch(
  getElectronLaunchOptions(path.join(root, 'profile')),
);
let page;
try {
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [directory],
    });
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  }, output);
  const open = async () => {
    const pending = app.waitForEvent('window');
    await main.evaluate(
      (file) => window.electronAPI.playlist.loadPlaylistFile(file),
      playlist,
    );
    const window = await pending;
    await (
      await app.browserWindow(window)
    ).evaluate((nativeWindow) => nativeWindow.setSize(1100, 800));
    await window.getByRole('button', { name: 'Sorter', exact: true }).click();
    await window.getByTestId('sorter-row-first').waitFor();
    return window;
  };
  page = await open();
  const inspector = () => page.getByTestId('playlist-clip-inspector');
  await page.getByTestId('sorter-row-second').getByRole('cell').nth(1).click();
  await inspector()
    .getByRole('radio', { name: 'アングル2', exact: true })
    .check();
  await inspector().getByText('クリップ詳細', { exact: true }).click();
  await page.keyboard.press(`${primaryModifier}+z`);
  await inspector()
    .getByRole('radio', { name: 'アングル1', exact: true })
    .waitFor();
  assert.equal(
    await inspector()
      .getByRole('radio', { name: 'アングル1', exact: true })
      .isChecked(),
    true,
  );
  await page.keyboard.press(`${primaryModifier}+Shift+z`);
  assert.equal(
    await inspector()
      .getByRole('radio', { name: 'アングル2', exact: true })
      .isChecked(),
    true,
  );
  await page
    .getByTestId('sorter-row-second')
    .getByText('アングル2 · yellow.mp4', { exact: true })
    .waitFor();
  await page.keyboard.press(`${primaryModifier}+s`);
  let saved;
  for (let attempt = 0; attempt < 100; attempt++) {
    saved = JSON.parse(
      await fs.readFile(path.join(playlist, 'playlist.json'), 'utf8'),
    );
    if (
      saved.items[1].defaultAngle === 'angle2' &&
      saved.items[1].mediaReference
    )
      break;
    await delay(100);
  }
  assert.equal(saved.items[1].defaultAngle, 'angle2');
  assert.ok(saved.items[0].mediaReference.packageId);
  assert.equal(
    saved.items[0].mediaReference.packageId,
    saved.items[1].mediaReference2.packageId,
  );
  assert.ok(!JSON.stringify(saved).includes('bookmark'));

  // Real continuous playback changes the displayed angle at the instance boundary.
  await page
    .getByTestId('sorter-row-first')
    .getByRole('cell')
    .nth(1)
    .dblclick();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('video')].some(
      (v) => v.currentSrc.endsWith('/blue.mp4') && !v.paused,
    ),
  );
  await page
    .locator('[data-testid="sorter-row-second"][aria-current="true"]')
    .waitFor({ timeout: 20000 });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('video')].some(
      (v) => v.currentSrc.endsWith('/red.mp4') && !v.paused && v.volume > 0,
    ),
  );
  await page.getByTestId('sorter-row-second').getByRole('cell').nth(1).click();

  const closing = page.waitForEvent('close');
  await (await app.browserWindow(page)).evaluate((window) => window.close());
  await closing;

  // Rename/move to an unrelated folder. Mac follows the bookmark; other OS learns it on package open.
  const relocatedDirectory = path.join(root, 'another-place');
  await fs.mkdir(relocatedDirectory);
  const relocated = path.join(relocatedDirectory, 'renamed.stpkg');
  await fs.rename(pkg, relocated);
  if (process.platform !== 'darwin') {
    await main.evaluate(
      (file) => window.electronAPI.preparePackageForOpen(file),
      relocated,
    );
  }
  page = await open();
  const resolved = await page.evaluate(
    (items) => window.electronAPI.playlist.resolveMediaReferences(items),
    saved.items,
  );
  assert.deepEqual(resolved.missingItemIds, []);
  assert.ok(
    resolved.items.every((item) => item.videoSource.includes('renamed.stpkg')),
  );
  await page.getByTestId('sorter-row-second').getByRole('cell').nth(1).click();
  assert.equal(
    await inspector()
      .getByRole('radio', { name: 'アングル2', exact: true })
      .isChecked(),
    true,
  );
  await page
    .getByTestId('sorter-row-second')
    .getByRole('cell')
    .nth(1)
    .dblclick();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('video')].some(
      (v) =>
        v.currentSrc.includes('renamed.stpkg') &&
        v.currentSrc.endsWith('/red.mp4') &&
        v.readyState >= 2,
    ),
  );
  await page.getByTestId('sorter-row-second').getByRole('cell').nth(1).click();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'playlist-default-angle.png',
      ),
    });
  }

  // Real export UI must retain each instance angle in a single output (not one file per angle).
  await page.keyboard.press(`${primaryModifier}+e`);
  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: 'プレイリストを書き出し' });
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByRole('button', { name: '各クリップの既定アングル', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.MuiDialog-container')].every(
        (element) => getComputedStyle(element).opacity === '1',
      ),
    );
    await page.screenshot({
      path: path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'playlist-angle-export.png',
      ),
    });
  }
  await dialog.getByLabel('ファイル名 (拡張子不要)').fill('chosen-angles');
  await dialog.getByRole('radio', { name: '含めない', exact: true }).check();
  const pending = app.waitForEvent('window');
  await dialog.getByRole('button', { name: '書き出す', exact: true }).click();
  const progress = await pending;
  await progress
    .getByText('書き出し完了', { exact: true })
    .waitFor({ timeout: 90000 });
  const files = (await fs.readdir(output)).filter((name) =>
    name.endsWith('.mp4'),
  );
  assert.equal(files.length, 1);
  const movie = path.join(output, files[0]);
  for (const [time, channel] of [
    [0.5, 2],
    [2.5, 0],
  ]) {
    const pixel = execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      movie,
      '-frames:v',
      '1',
      '-vf',
      'scale=1:1',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      'pipe:1',
    ]);
    assert.ok(
      pixel[channel] > 150 &&
        pixel[channel] > pixel[(channel + 1) % 3] + 100 &&
        pixel[channel] > pixel[(channel + 2) % 3] + 100,
      `wrong angle at ${time}: ${[...pixel]}`,
    );
  }
  const duration = Number(
    execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        movie,
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(
    Math.abs(duration - 4) < 0.2,
    `Unexpected output duration ${duration}`,
  );
  console.log(
    'Playlist default angles, Undo/Redo, save/reload, continuous multi-clip playback, package relocation, and single-file export pixels: passed',
  );
} catch (error) {
  if (page)
    console.error(
      await page
        .locator('body')
        .innerText()
        .catch(() => 'page unavailable'),
    );
  throw error;
} finally {
  await app.close();
  await fs.rm(root, { recursive: true, force: true });
}
