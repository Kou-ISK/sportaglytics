import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'playback-buffering-'));
const pkg = path.join(root, 'Synthetic.stpkg');
await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
await fs.mkdir(path.join(pkg, 'videos'));
for (const [index, color] of ['red', 'blue'].entries()) {
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=160x90:r=30:d=30`,
    '-threads',
    '1',
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    path.join(pkg, `videos/${index}.mp4`),
  ]);
}
await fs.writeFile(
  path.join(pkg, '.metadata/config.json'),
  JSON.stringify({
    packageFormatVersion: 1,
    team1Name: 'Red',
    team2Name: 'Blue',
    primaryAngleId: 'one',
    angles: ['one', 'two'].map((id, index) => ({
      id,
      name: id,
      sourceKind: 'local',
      relativePath: `videos/${index}.mp4`,
      clips: [
        {
          id: `clip-${id}`,
          sourceKind: 'local',
          relativePath: `videos/${index}.mp4`,
          timelineStartSeconds: 0,
          gapBeforeSeconds: 0,
          durationSeconds: 30,
        },
      ],
    })),
  }),
);
await fs.writeFile(
  path.join(pkg, 'timeline.json'),
  JSON.stringify({
    version: 2,
    rows: [{ id: 'row', name: 'Attack', color: '#2277aa' }],
    instances: [],
  }),
);
let app;
try {
  app = await electron.launch(
    getElectronLaunchOptions(path.join(root, 'profile')),
  );
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await main
    .getByRole('button', { name: 'パッケージを開く', exact: true })
    .waitFor();
  await app.evaluate(
    ({ app }, file) => app.emit('open-file', { preventDefault() {} }, file),
    pkg,
  );
  await main.waitForFunction(
    () =>
      document.querySelectorAll('video').length === 2 &&
      [...document.querySelectorAll('video')].every((v) => v.readyState >= 3),
  );
  await main.evaluate(() => window.electronAPI.timelineWindow.openWindow());
  let timeline;
  for (let i = 0; i < 100; i++) {
    timeline = app.windows().find((w) => w.url().includes('#/timeline'));
    if (timeline) break;
    await main.waitForTimeout(50);
  }
  await timeline.getByTestId('timeline-ruler').waitFor();
  await timeline.keyboard.press('Space');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => !v.paused && v.currentTime > 1,
    ),
  );
  const beforeHidden = await main.evaluate(() =>
    [...document.querySelectorAll('video')].map((v) => v.currentTime),
  );
  const mainWindow = await app.browserWindow(main);
  await mainWindow.evaluate((window) => window.hide());
  await main.waitForTimeout(700);
  await mainWindow.evaluate((window) => window.show());
  const afterHidden = await main.evaluate(() =>
    [...document.querySelectorAll('video')].map((v) => v.currentTime),
  );
  assert.ok(
    afterHidden.every((time, i) => time > beforeHidden[i] + 0.4),
    'hidden playback continues without a catch-up seek on restore',
  );
  await main.evaluate(() => {
    window.bufferingSeeks = 0;
    document.addEventListener('seeking', () => window.bufferingSeeks++, true);
  });
  for (const index of [0, 1]) {
    // Deterministic decoder stall: only readiness and the stalled native
    // transport are controlled. Package clock, React, IPC and peers stay real.
    const before = await main.evaluate((index) => {
      const videos = [...document.querySelectorAll('video')];
      Object.defineProperty(videos[index], 'readyState', {
        configurable: true,
        value: 1,
      });
      videos[index].pause();
      return videos.map((v) => v.currentTime);
    }, index);
    await main.waitForTimeout(800);
    const held = await main.evaluate(() =>
      [...document.querySelectorAll('video')].map((v) => ({
        time: v.currentTime,
        paused: v.paused,
      })),
    );
    assert.ok(
      held.every((v) => v.paused),
      `all active angles wait for decoder ${index}: ${JSON.stringify(held)}`,
    );
    assert.ok(
      held.every((v, i) => Math.abs(v.time - before[i]) < 0.15),
      'ready peers must not run ahead of the frozen package clock',
    );
    if (index === 0) {
      await timeline.keyboard.down('ArrowRight');
      await main.waitForFunction(() =>
        [...document.querySelectorAll('video')].every(
          (v) => v.playbackRate === 0.5,
        ),
      );
    }
    await main.evaluate((index) => {
      delete document.querySelectorAll('video')[index].readyState;
    }, index);
    await main.waitForFunction(
      (before) =>
        [...document.querySelectorAll('video')].every(
          (v, i) => !v.paused && v.currentTime > before[i] + 0.3,
        ),
      before,
    );
    if (index === 0) {
      await timeline.keyboard.up('ArrowRight');
      await main.waitForFunction(() =>
        [...document.querySelectorAll('video')].every(
          (v) => v.playbackRate === 1 && !v.paused,
        ),
      );
    }
  }
  // Pause during buffering cancels the resume intent.
  await main.evaluate(() => {
    const video = document.querySelector('video');
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: 1,
    });
    video.pause();
  });
  await main.waitForTimeout(150);
  await timeline.keyboard.press('Space');
  await main.evaluate(() => {
    delete document.querySelector('video').readyState;
  });
  await main.waitForTimeout(400);
  assert.ok(
    await main.evaluate(() =>
      [...document.querySelectorAll('video')].every((v) => v.paused),
    ),
    'recovery must respect explicit pause',
  );
  await timeline.keyboard.press('Space');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every((v) => !v.paused),
  );
  await main.waitForTimeout(500);
  const seeks = await main.evaluate(() => window.bufferingSeeks);
  assert.ok(
    seeks <= 2,
    `buffering must not trigger correction loops (${seeks})`,
  );
  console.log(
    `Both decoder waits hold all angles, recover and respect pause (${seeks} seeks)`,
  );
} finally {
  await app?.close().catch(() => undefined);
  await fs.rm(root, { recursive: true, force: true });
}
