import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { getSyncTimeline, seekSyncTime } from './e2e-angle-sync-workspace.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'angle-sync-gaps-'));
let app;
const launch = (args = []) =>
  electron.launch(getElectronLaunchOptions(path.join(dir, 'profile'), args));
try {
  const sources = ['A', 'C', 'D'].map((name, index) => {
    const dest = path.join(dir, `${name}.mp4`);
    execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=${['red', 'green', 'yellow'][index]}:s=160x90:r=25:d=${[30, 10, 5][index]}`,
      '-c:v',
      fixtureH264Encoder,
      '-pix_fmt',
      'yuv420p',
      '-y',
      dest,
    ]);
    return dest;
  });
  app = await launch();
  let page = await app.firstWindow();
  await page.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  const created = await page.evaluate(
    ({ dir, sources }) =>
      window.electronAPI.createPackage(
        dir,
        'unequal-angles',
        [
          {
            id: 'one',
            name: 'Angle 1',
            clips: [
              {
                id: 'A',
                sourceKind: 'local',
                source: sources[0],
                gapBeforeSeconds: 0,
              },
            ],
          },
          {
            id: 'two',
            name: 'Angle 2',
            clips: sources.slice(1).map((source, i) => ({
              id: ['C', 'D'][i],
              sourceKind: 'local',
              source,
              gapBeforeSeconds: 0,
            })),
          },
        ],
        { team1Name: 'Red', team2Name: 'Blue' },
      ),
    { dir, sources },
  );
  let config = JSON.parse(
    await fs.readFile(created.metaDataConfigFilePath, 'utf8'),
  );
  assert.deepEqual(
    config.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    [0, 10],
    'unsynchronized sources must be contiguous',
  );
  await app.close();
  app = await launch([path.join(dir, 'unequal-angles.stpkg')]);
  page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  await page.locator('#video_0 video').waitFor();
  await page.keyboard.press(`${primaryModifier}+Shift+T`);
  const timeline = await getSyncTimeline(app);
  timeline.setDefaultTimeout(20000);
  assert.equal(await page.getByRole('slider').count(), 0);
  await timeline.keyboard.press('Shift+1');
  await seekSyncTime(timeline, 26);
  await page.waitForFunction(() => {
    const video = document.querySelector('#sync_angle_0 video');
    return !video.seeking && Math.abs(video.currentTime - 26) < 0.001;
  });
  await timeline.keyboard.press('s');
  await timeline.getByLabel('Angle 1の同期点', { exact: true }).waitFor();
  await timeline.keyboard.press('Shift+2');
  // Drag the existing timeline playhead; do not bypass the window command route.
  const handle = timeline.getByRole('slider', {
    name: 'タイムラインの再生位置',
  });
  const firstClip = await timeline
    .getByTestId('timeline-time-origin')
    .boundingBox();
  const handleRect = await handle.boundingBox();
  await timeline.mouse.move(
    handleRect.x + handleRect.width / 2,
    handleRect.y + 8,
  );
  await timeline.mouse.down();
  await timeline.mouse.move(
    firstClip.x + (firstClip.width * 11) / 30,
    handleRect.y + 8,
    { steps: 8 },
  );
  await timeline.mouse.up();
  await page.waitForFunction(() => {
    const v = document.querySelector('#sync_angle_1 video');
    return (
      /D\.mp4$/.test(v.currentSrc) &&
      !v.seeking &&
      Math.abs(v.currentTime - 1) < 0.15
    );
  });
  // Snap to a known frame after coarse dragging, using the timeline timecode and frame hotkeys.
  await seekSyncTime(timeline, 11);
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector('#sync_angle_1 video').currentTime - 1) <
      0.001,
  );
  await timeline.keyboard.press('ArrowRight');
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector('#sync_angle_1 video').currentTime - 1.0401,
      ) < 0.001,
  );
  await timeline.keyboard.press('ArrowLeft');
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector('#sync_angle_1 video').currentTime - 1.0001,
      ) < 0.001,
  );
  await timeline.keyboard.press('s');
  await timeline.getByLabel('Angle 2の同期点', { exact: true }).waitFor();
  await timeline
    .getByRole('button', { name: 'アングルを同期', exact: true })
    .click();
  await seekSyncTime(timeline, 15);
  await page.getByText('この位置に映像はありません', { exact: true }).waitFor();
  assert.equal(
    await page.locator('#sync_angle_1').isVisible(),
    false,
    'gap must not show a stale player frame',
  );
  await fs.mkdir('output/playwright', { recursive: true });
  await timeline.screenshot({
    path: 'output/playwright/angle-sync-unequal-timeline.png',
  });
  await page.screenshot({
    path: 'output/playwright/angle-sync-unequal-video.png',
  });
  await timeline
    .getByRole('button', { name: '保存して閉じる', exact: true })
    .click();
  await page.locator('#video_0 video').waitFor();
  config = JSON.parse(
    await fs.readFile(created.metaDataConfigFilePath, 'utf8'),
  );
  assert.deepEqual(
    config.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    [0, 25],
  );
  assert.equal(config.angles[0].clips.length, 1);
  const out = path.join(dir, 'export');
  await fs.mkdir(out);
  const result = await page.evaluate(
    ({ created, out }) =>
      window.electronAPI.exportClipsWithOverlay({
        sourcePath: created.angles[0].absolutePath,
        sourcePath2: created.angles[1].absolutePath,
        mode: 'dual',
        angleOption: 'multi',
        exportMode: 'perInstance',
        outputDir: out,
        outputFileName: 'gap-check',
        clips: [{ id: 'gap', actionName: 'gap', startTime: 0, endTime: 30 }],
        overlay: {
          enabled: false,
          showActionName: false,
          showActionIndex: false,
          showLabels: false,
          showMemo: false,
        },
      }),
    { created, out },
  );
  assert.equal(result.success, true, result.error);
  const output = path.join(
    out,
    (await fs.readdir(out)).find((name) => name.endsWith('.mp4')),
  );
  const pixel = (time, x) => [
    ...execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      output,
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
  for (const time of [10.1, 15, 24.9]) {
    assert.ok(
      pixel(time, 200).every((value) => value < 10),
      'only the missing angle is black',
    );
    assert.ok(
      pixel(time, 40)[0] > 240,
      'angle 1 continues through the missing interval',
    );
  }
  assert.ok(pixel(9, 200)[1] > 110);
  assert.ok(pixel(26, 200)[0] > 240 && pixel(26, 200)[1] > 240);
  await app.close();
  app = await launch([path.join(dir, 'unequal-angles.stpkg')]);
  page = await app.firstWindow();
  await page.locator('#video_0 video').waitFor();
  let normalTimeline = app
    .windows()
    .find((item) => item.url().includes('#/timeline'));
  if (!normalTimeline)
    normalTimeline = await app.waitForEvent('window', {
      predicate: (item) => item.url().includes('#/timeline'),
      timeout: 15000,
    });
  await normalTimeline
    .getByRole('slider', { name: 'タイムラインの再生位置' })
    .waitFor();
  await normalTimeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({ type: 'seek', time: 15 }),
  );
  await page.locator('#video_1').waitFor({ state: 'detached' });
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector('#video_0 video').currentTime - 15) < 0.1,
  );
  await normalTimeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({ type: 'seek', time: 26 }),
  );
  await page.waitForFunction(() => {
    const v = document.querySelector('#video_1 video');
    return (
      v && /D\.mp4$/.test(v.currentSrc) && Math.abs(v.currentTime - 1) < 0.1
    );
  });
  console.log(
    'Unequal clip counts, timeline playhead drag, cross-window frame shortcuts, contiguous import, 10–25 second gap, save/reopen and exported pixels passed',
  );
} catch (error) {
  if (app)
    for (const page of app.windows()) {
      if (page.url().includes('#/timeline'))
        console.log(await page.locator('body').innerText());
    }
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
}
