import {
  exerciseAngleSync,
  getSyncTimeline,
} from './e2e-angle-sync-workspace.mjs';
import { exerciseMultiClipCoding } from './e2e-multi-clip-coding.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
const dir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-multiclip-'),
);
const sources = ['A', 'B', 'C', 'D'].map((name, i) => {
  const dest = path.join(dir, name + '.mp4');
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${['red', 'blue', 'green', 'yellow'][i]}:s=160x90:r=${[25, 25, 50, 50][i]}:d=6`,
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    '-y',
    dest,
  ]);
  return dest;
});
let app;
try {
  app = await electron.launch(
    getElectronLaunchOptions(path.join(dir, 'profile')),
  );
  console.log('Fixture Electron launched');
  let page = await app.firstWindow();
  await page.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  console.log('Creating synthetic package');
  const data = await page.evaluate(
    async ({ dir, sources }) => {
      const created = await window.electronAPI.createPackage(
        dir,
        'pair-check',
        [
          {
            id: 'one',
            name: 'Angle 1',
            clips: sources.slice(0, 2).map((source, i) => ({
              id: ['A', 'B'][i],
              sourceKind: 'local',
              source,
              gapBeforeSeconds: 0,
            })),
          },
          {
            id: 'two',
            name: 'Angle 2',
            clips: sources.slice(2).map((source, i) => ({
              id: ['C', 'D'][i],
              sourceKind: 'local',
              source,
              gapBeforeSeconds: 0,
            })),
          },
        ],
        { team1Name: 'Red', team2Name: 'Blue' },
      );
      return window.electronAPI.applyClipTimeline(
        created.metaDataConfigFilePath,
        [
          { clipId: 'A', timelineStartSeconds: 0 },
          { clipId: 'B', timelineStartSeconds: 6 },
          { clipId: 'C', timelineStartSeconds: 1 },
          { clipId: 'D', timelineStartSeconds: 8 },
        ],
      );
    },
    { dir, sources },
  );
  console.log('Synthetic package created');
  const config = JSON.parse(
    await fs.readFile(data.metaDataConfigFilePath, 'utf8'),
  );
  config.syncData = { syncOffset: 0, angleOffsets: [0, 0], isAnalyzed: true };
  await fs.writeFile(data.metaDataConfigFilePath, JSON.stringify(config));
  await fs.writeFile(
    path.join(dir, 'pair-check.stpkg', 'timeline.json'),
    JSON.stringify({
      version: 2,
      rows: [
        { id: 'attack', name: 'Attack', color: '#2878d0' },
        { id: 'defence', name: 'Defence', color: '#b24d36' },
      ],
      instances: [
        {
          id: 'play-1',
          actionName: 'Attack',
          startTime: 1,
          endTime: 4,
          memo: '',
          color: '#2878d0',
        },
      ],
    }),
  );
  console.log('Reopening package');
  await app.close();
  app = await electron.launch(
    getElectronLaunchOptions(path.join(dir, 'profile'), [
      path.join(dir, 'pair-check.stpkg'),
    ]),
  );
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  console.log('Package window opened');
  await page.locator('#video_0 video').waitFor({ timeout: 30000 });
  // A real settings round trip: both ordinary playback and sync use these keys.
  assert.equal(
    await page.evaluate(async () => {
      const settings = await window.electronAPI.loadSettings();
      settings.hotkeys = settings.hotkeys.map((key) =>
        key.id === 'toggle-angle1'
          ? { ...key, key: 'Control+Shift+K' }
          : key.id === 'toggle-angle2'
            ? { ...key, key: 'Control+Shift+L' }
            : key,
      );
      return window.electronAPI.saveSettings(settings);
    }),
    true,
  );
  await page.evaluate(() => window.electronAPI.timelineWindow.openWindow());
  const settingsTimeline = await getSyncTimeline(app);
  await settingsTimeline.getByTestId('timeline-ruler').waitFor();
  await settingsTimeline.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          off();
          reject(new Error('Customized angle keys did not reach Timeline'));
        }, 10000);
        const off = window.electronAPI.timelineWindow.onSync((snapshot) => {
          if (
            snapshot.hotkeys.some(
              (key) =>
                key.id === 'toggle-angle1' && key.key === 'Control+Shift+K',
            )
          ) {
            clearTimeout(timeout);
            off();
            resolve();
          }
        });
        window.electronAPI.timelineWindow.sendCommand({ type: 'request-sync' });
      }),
  );
  await page.bringToFront();
  await page.keyboard.press('Control+Shift+K');
  await page.waitForFunction(
    () =>
      document.querySelector('#video_0')?.getBoundingClientRect().width >
      innerWidth * 0.85,
  );
  await page.keyboard.press('Control+Shift+K');
  await page.waitForFunction(
    () =>
      document.querySelector('#video_0')?.getBoundingClientRect().width <
      innerWidth * 0.6,
  );

  await page
    .getByRole('button', { name: '再生', exact: true })
    .click({ force: true });
  const sample = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('video')].map((video) => ({
        source: video.currentSrc.split('/').pop(),
        time: video.currentTime,
      })),
    );
  await page.waitForTimeout(3000);
  const firstHalf = await sample();
  assert.match(firstHalf[0].source, /A\.mp4$/);
  assert.match(firstHalf[1].source, /C\.mp4$/);
  assert.ok(
    Math.abs(firstHalf[0].time - firstHalf[1].time - 1) < 0.2,
    'first-half source clocks must reflect the one-second placement difference',
  );
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('video')].some(
        (video) => /D\.mp4$/.test(video.currentSrc) && video.currentTime > 0.3,
      ),
    undefined,
    { timeout: 15000 },
  );
  const secondHalf = await sample();
  assert.match(secondHalf[0].source, /B\.mp4$/);
  assert.match(secondHalf[1].source, /D\.mp4$/);
  assert.ok(
    Math.abs(secondHalf[0].time - secondHalf[1].time - 2) < 0.2,
    'second-half source clocks must use their independent two-second difference',
  );
  await page
    .getByRole('button', { name: '一時停止', exact: true })
    .click({ force: true });
  await exerciseMultiClipCoding(
    app,
    page,
    settingsTimeline,
    path.join(dir, 'pair-check.stpkg', 'timeline.json'),
  );
  await exerciseAngleSync(page, app, ['Control+Shift+K', 'Control+Shift+L']);
  // Closing the sync surface precedes the async config write. Read only a completed document.
  let applied;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      applied = JSON.parse(
        await fs.readFile(data.metaDataConfigFilePath, 'utf8'),
      );
      break;
    } catch (error) {
      if (!(error instanceof SyntaxError) || attempt === 49) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.deepEqual(
    applied.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    [1, 8],
  );
  assert.equal(
    applied.syncData.syncOffset,
    0,
    'clip placement must not overwrite the angle correction from unrelated player clocks',
  );
  console.log('Independent pair placement and main playback passed');
  const out = path.join(dir, 'exports');
  await fs.mkdir(out);
  const exportPair = async (name) => {
    const result = await page.evaluate(
      async ({ data, out, name }) =>
        window.electronAPI.exportClipsWithOverlay({
          sourcePath: data.angles[0].absolutePath,
          sourcePath2: data.angles[1].absolutePath,
          mode: 'dual',
          angleOption: 'multi',
          exportMode: 'perInstance',
          outputDir: out,
          outputFileName: name,
          clips: [{ id: name, actionName: name, startTime: 0, endTime: 12 }],
          overlay: {
            enabled: false,
            showActionName: false,
            showActionIndex: false,
            showLabels: false,
            showMemo: false,
          },
        }),
      { data, out, name },
    );
    assert.equal(result?.success, true, result?.error);
    const files = await fs.readdir(out);
    return path.join(out, files.find((x) => x.includes(name)) || files.at(-1));
  };
  const pixel = (file, t, x) => [
    ...execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-ss',
      String(t),
      '-i',
      file,
      '-vf',
      `format=rgb24,crop=1:1:${x}:45`,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ]),
  ];
  const first = await exportPair('placements');
  assert.ok(pixel(first, 3, 40)[0] > 240 && pixel(first, 3, 200)[1] > 110);
  assert.ok(
    pixel(first, 9, 40)[2] > 240 &&
      pixel(first, 9, 200)[0] > 240 &&
      pixel(first, 9, 200)[1] > 240,
  );
  config.syncData = { syncOffset: 2, angleOffsets: [0, 2], isAnalyzed: true };
  await fs.writeFile(data.metaDataConfigFilePath, JSON.stringify(config));
  const second = await exportPair('offset');
  assert.ok(
    pixel(second, 0.5, 200)[1] > 110,
    'positive correction must expose C at global 0.5 seconds',
  );
  assert.ok(
    Math.abs(
      Number(
        execFileSync(ffprobePath, [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=nw=1:nk=1',
          first,
        ]).toString(),
      ) - 12,
    ) < 0.1,
  );
  config.syncData = { syncOffset: -1, angleOffsets: [0, -1], isAnalyzed: true };
  await fs.writeFile(data.metaDataConfigFilePath, JSON.stringify(config));
  const negative = await exportPair('negative');
  assert.ok(
    pixel(negative, 1.5, 200).every((value) => value < 10),
    'negative correction retains its leading gap',
  );
  assert.ok(pixel(negative, 2.5, 200)[1] > 110);
  // Restore the positive correction for the independent Playlist player.
  config.syncData = { syncOffset: 2, angleOffsets: [0, 2], isAnalyzed: true };
  await fs.writeFile(data.metaDataConfigFilePath, JSON.stringify(config));
  console.log('Signed corrections and exported pixels passed');
  const bundle = path.join(dir, 'review.stpl');
  await fs.mkdir(bundle);
  await fs.writeFile(
    path.join(bundle, 'playlist.json'),
    JSON.stringify({
      id: 'review',
      name: 'Pair review',
      type: 'reference',
      createdAt: 1,
      updatedAt: 1,
      items: [
        {
          id: 'second-half',
          timelineItemId: 'review-item',
          actionName: 'Second half',
          startTime: 4,
          endTime: 11,
          addedAt: 1,
          videoSource: data.angles[0].absolutePath,
          videoSource2: data.angles[1].absolutePath,
        },
      ],
    }),
  );
  const [review] = await Promise.all([
    app.waitForEvent('window', { timeout: 10000 }),
    page.evaluate(
      (folder) => window.electronAPI.playlist.loadPlaylistFile(folder),
      bundle,
    ),
  ]);
  await review.getByTestId('organizer-clip-second-half').waitFor();
  await review.getByTestId('organizer-clip-second-half').dblclick();
  await review.waitForFunction(
    () =>
      [...document.querySelectorAll('video')].every(
        (video) =>
          video.readyState >= 2 &&
          /[BD]\.mp4$/.test(video.currentSrc) &&
          video.currentTime > 0.2,
      ),
    undefined,
    { timeout: 15000 },
  );
  const reviewTimes = await review.evaluate(() =>
    [...document.querySelectorAll('video')].map((video) => video.currentTime),
  );
  assert.ok(
    Math.abs(reviewTimes[0] - reviewTimes[1]) < 0.2,
    'Playlist must apply the two-second correction after crossing both source boundaries',
  );
  await review.keyboard.press('Space');
  await review.getByRole('button', { name: 'Paint', exact: true }).click();
  await review.getByLabel('Paint クリップ').getByRole('button').first().click();
  // Jump through the common timeline slider, rather than seeking a raw source video.
  const ruler = review.getByRole('slider', {
    name: '描画タイムラインの再生位置',
  });
  await ruler.focus();
  await review.keyboard.press('Home');
  await review.waitForFunction(() =>
    /A\.mp4$/.test(document.querySelector('video')?.currentSrc ?? ''),
  );
  await review.keyboard.press('End');
  await review.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (video) =>
        /[BD]\.mp4$/.test(video.currentSrc) &&
        Math.abs(video.currentTime - 5) < 0.12,
    ),
  );
  console.log(
    'Playlist crossing, Paint seek and signed synchronization passed',
  );
} catch (error) {
  if (app) {
    const main = (await app.windows())[0];
    await fs.mkdir('output/playwright', { recursive: true });
    await main
      .screenshot({ path: 'output/playwright/angle-sync-failure.png' })
      .catch(() => undefined);
    console.log(await main.locator('body').innerText());
    console.error(
      'Synthetic media events',
      await main.evaluate(() => window.__angleSyncMediaEvents ?? []),
    );
    console.error(
      'Synthetic media state',
      await main.evaluate(() =>
        [...document.querySelectorAll('video')].map((v) => ({
          source: v.currentSrc.split(/[\\/]/).pop(),
          time: v.currentTime,
          seeking: v.seeking,
          ready: v.readyState,
          network: v.networkState,
          paused: v.paused,
          error: v.error?.code,
          visible: document.visibilityState,
        })),
      ),
    );
  }
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
}
