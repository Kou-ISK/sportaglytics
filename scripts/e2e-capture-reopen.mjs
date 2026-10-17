import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import {
  getElectronLaunchOptions,
  observeElectronErrors,
} from './e2e-electron-launch.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-reopen-'));
const pkg = path.join(root, 'Synthetic capture 日本語 #%.stpkg');
const artifacts = path.resolve(
  process.env.E2E_SCREENSHOT_DIR ?? 'output/playwright',
  'capture-reopen',
);
await fs.mkdir(artifacts, { recursive: true });
await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
await fs.mkdir(path.join(pkg, 'media'));
const fixture = path.join(pkg, 'media', '0.mp4');
// Deliberately shorter audio tail: EOS must expose the final video frame.
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=640x360:rate=30:duration=2',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:duration=2',
  '-c:v',
  fixtureH264Encoder,
  '-g',
  '60',
  '-bf',
  '0',
  '-c:a',
  'aac',
  '-movflags',
  '+frag_keyframe+empty_moov+default_base_moof',
  fixture,
]);
const clips = [];
for (let i = 0; i < 42; i++) {
  if (i) await fs.copyFile(fixture, path.join(pkg, 'media', `${i}.mp4`));
  clips.push({
    id: `clip-${i}`,
    sourceKind: 'local',
    relativePath: `media/${i}.mp4`,
    gapBeforeSeconds: 0,
    timelineStartSeconds: i * 2,
    durationSeconds: 2,
  });
}
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-y',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=640x360:rate=30:duration=2',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:duration=1.8',
  '-c:v',
  fixtureH264Encoder,
  '-g',
  '60',
  '-bf',
  '0',
  '-c:a',
  'aac',
  '-movflags',
  '+frag_keyframe+empty_moov+default_base_moof',
  path.join(pkg, 'media', '41.mp4'),
]);
await fs.writeFile(
  path.join(pkg, '.metadata/config.json'),
  JSON.stringify({
    packageFormatVersion: 1,
    angles: [
      {
        id: 'camera',
        name: 'Camera',
        sourceKind: 'local',
        playbackFormat: 'fragmented-mp4',
        relativePath: 'media/0.mp4',
        clips,
      },
    ],
    liveCapture: {
      version: 1,
      id: 'synthetic',
      name: 'Synthetic',
      phase: 'completed',
    },
  }),
);
const timelineDocument = JSON.stringify({
  version: 2,
  rows: [{ id: 'row', name: 'Event', color: '#123456' }],
  instances: [{ id: 'event', actionName: 'Event', startTime: 28, endTime: 37 }],
});
await fs.writeFile(path.join(pkg, 'timeline.json'), timelineDocument);
let app;
try {
  // Seed onboarding before startup-file delivery. Its async first-run dialog
  // can otherwise appear after the video becomes ready and hide the controls.
  app = await electron.launch(
    getElectronLaunchOptions(path.join(root, 'profile')),
  );
  const setup = await app.firstWindow();
  await setup.waitForLoadState();
  await setup.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await app.close();
  app = undefined;
  for (let run = 0; run < 2; run++) {
    app = await electron.launch(
      getElectronLaunchOptions(path.join(root, 'profile'), [pkg]),
    );
    observeElectronErrors(app);
    const main = await app.firstWindow();
    await main.locator('#video_0 video').waitFor({ timeout: 30000 });
    await main.waitForFunction(
      () => document.querySelector('#video_0 video')?.readyState >= 3,
    );
    assert.equal(
      await main.locator('#video_0 video').evaluate((v) => v.duration),
      84,
    );
    let timeline;
    for (let i = 0; i < 50; i++) {
      timeline = app.windows().find((p) => p.url().includes('#/timeline'));
      if (timeline) break;
      await main.waitForTimeout(100);
    }
    assert.ok(timeline);
    await timeline.getByTestId('timeline-instance-event').waitFor();
    for (const time of [60, 3, 80, 25, 83.9, 1]) {
      await timeline.evaluate(
        (t) =>
          window.electronAPI.timelineWindow.sendCommand({
            type: 'seek',
            time: t,
          }),
        time,
      );
      console.log('Capture seek request', run, time);
      await main.waitForFunction(
        (t) => {
          const v = document.querySelector('#video_0 video');
          return (
            v?.readyState >= 3 &&
            !v.seeking &&
            Math.abs(v.currentTime - t) < 0.06
          );
        },
        time,
        { timeout: 10000 },
      );
    }
    await main.evaluate(() => {
      globalThis.savedCaptureVideo = document.querySelector('#video_0 video');
    });
    await main
      .getByRole('button', { name: '再生', exact: true })
      .click({ force: true });
    await main.waitForFunction(
      () => document.querySelector('#video_0 video')?.currentTime > 5,
      null,
      { timeout: 10000 },
    );
    assert.equal(
      await main.evaluate(
        () =>
          globalThis.savedCaptureVideo ===
          document.querySelector('#video_0 video'),
      ),
      true,
    );
    await main
      .getByRole('button', { name: '一時停止', exact: true })
      .click({ force: true });
    await main.screenshot({ path: path.join(artifacts, `reopen-${run}.png`) });
    assert.equal(
      await fs.readFile(path.join(pkg, 'timeline.json'), 'utf8'),
      timelineDocument,
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    app = undefined;
  }
  console.log(
    'Saved capture: full duration, distant forward/backward seeks, short audio tail, same decoder across clips, coded interval and new-process reopen passed',
  );
} finally {
  if (app) {
    for (const page of app.windows())
      console.log(
        'Capture failure state',
        await page.evaluate(() =>
          [...document.querySelectorAll('video')].map((v) => ({
            ready: v.readyState,
            time: v.currentTime,
            seeking: v.seeking,
            paused: v.paused,
            duration: v.duration,
            error: v.error?.message,
            buffered: Array.from({ length: v.buffered.length }, (_, i) => [
              v.buffered.start(i),
              v.buffered.end(i),
            ]),
          })),
        ),
      );

    await app
      .evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
      )
      .catch(() => {});
    await app.close();
  }
  await fs.rm(root, { recursive: true, force: true });
}
