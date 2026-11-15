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
let main;
try {
  app = await electron.launch(
    getElectronLaunchOptions(path.join(root, 'profile')),
  );
  main = await app.firstWindow();
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
    window.bufferingPhase = 'drift-control';
    window.bufferingTrace = [];
    window.bufferingTraceTruncated = false;
    window.bufferingPhaseSeeks = {};
    for (const eventName of ['seeking', 'seeked']) {
      document.addEventListener(eventName, (event) => {
        const video = event.target;
        if (!(video instanceof HTMLVideoElement)) return;
        if (eventName === 'seeking') {
          window.bufferingSeeks++;
          const index = [...document.querySelectorAll('video')].indexOf(video);
          const counts = window.bufferingPhaseSeeks[window.bufferingPhase] ?? {};
          counts[index] = (counts[index] ?? 0) + 1;
          window.bufferingPhaseSeeks[window.bufferingPhase] = counts;
        }
        if (window.bufferingTrace.length < 256) window.bufferingTrace.push({
          event: eventName, phase: window.bufferingPhase, at: performance.now(),
          video: [...document.querySelectorAll('video')].indexOf(video),
          currentTime: video.currentTime, seeking: video.seeking,
          paused: video.paused, readyState: video.readyState,
        });
        else window.bufferingTraceTruncated = true;
      }, true);
    }
  });
  for (const drift of [0.7, -0.7]) {
    await main.evaluate((drift) => {
      const video = document.querySelectorAll('video')[1];
      video.currentTime += drift;
    }, drift);
    await main.waitForFunction(() => {
      const [one, two] = [...document.querySelectorAll('video')];
      return (
        !one.paused &&
        !two.paused &&
        !one.seeking &&
        !two.seeking &&
        Math.abs(one.currentTime - two.currentTime) < 0.15
      );
    });
    console.log(`Recovered native transport drift ${drift}`);
  }
  await main.evaluate(() => {
    window.bufferingSeeks = 0;
    window.bufferingPhase = 'decoder-stalls';
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
      await main.bringToFront();
      await main.evaluate(() => document.activeElement?.blur());
      await main.keyboard.press('Shift+2');
      await main.waitForFunction(() => {
        const [one, two] = [...document.querySelectorAll('video')];
        const hidden = (v) => {
          for (let e = v; e; e = e.parentElement)
            if (getComputedStyle(e).opacity === '0') return true;
          return false;
        };
        return hidden(one) && !hidden(two);
      });
      assert.ok(
        await main.evaluate(() =>
          [...document.querySelectorAll('video')].every((v) => v.paused),
        ),
        'view switch preserves shared buffering',
      );
      await main.bringToFront();
      await main.evaluate(() => document.activeElement?.blur());
      await main.keyboard.press('Shift+2');
      await main.waitForFunction(() =>
        [...document.querySelectorAll('video')].every((v) => {
          for (let e = v; e; e = e.parentElement)
            if (getComputedStyle(e).opacity === '0') return false;
          return true;
        }),
      );
      console.log('Angle view switch and restore during hold passed');
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
  // Observe completed recovery before switching to deliberate user operations.
  // A precise pause correction has its own contract and is not a decoder loop.
  await main.waitForFunction(() => [...document.querySelectorAll('video')].every((v) => !v.seeking && !v.paused));
  await main.waitForTimeout(500);
  assert.ok(await main.evaluate(() => {
    const videos = [...document.querySelectorAll('video')];
    return videos.every(v => !v.seeking && !v.paused) && Math.abs(videos[0].currentTime-videos[1].currentTime) < 0.15;
  }), 'decoder recovery remains synchronized after observation');
  const seeks = await main.evaluate(() => window.bufferingSeeks);
  console.log('Decoder recovery seek trace:', await main.evaluate(() => window.bufferingTrace));
  assert.ok(seeks <= 2, `buffering must not trigger correction loops (${seeks})`);
  const pauseStartSeeks = await main.evaluate(() => { window.bufferingPhase = 'explicit-pause'; return window.bufferingSeeks; });
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
  await main.waitForFunction(() => [...document.querySelectorAll('video')].every((v) => v.paused && !v.seeking), undefined, { timeout: 5000 });
  const pauseTimes = await main.evaluate(() => [...document.querySelectorAll('video')].map(v=>v.currentTime));
  const pausedSeeks = await main.evaluate(() => window.bufferingSeeks);
  console.log('Explicit pause seek trace:', await main.evaluate(() => window.bufferingTrace));
  assert.ok(pausedSeeks - pauseStartSeeks <= 2, 'explicit pause has a bounded correction count');
  assert.ok(await main.evaluate(() => Object.values(window.bufferingPhaseSeeks['explicit-pause'] ?? {}).every(count=>count<=1)), 'explicit pause permits at most one precise correction per angle');
  await main.waitForTimeout(500);
  assert.equal(await main.evaluate(() => window.bufferingSeeks), pausedSeeks, 'settled explicit pause must not start a seek loop');
  assert.ok(await main.evaluate((before) => [...document.querySelectorAll('video')].every((v,i)=>v.paused && !v.seeking && Math.abs(v.currentTime-before[i])<0.001), pauseTimes), 'settled pause keeps all angle clocks fixed');
  const resumeStartSeeks = await main.evaluate(() => { window.bufferingPhase = 'explicit-resume'; return window.bufferingSeeks; });
  const resumeTimes = await main.evaluate(() => [...document.querySelectorAll('video')].map(v => v.currentTime));
  await timeline.keyboard.press('Space');
  await main.waitForFunction((before) => {
    const videos = [...document.querySelectorAll('video')];
    return videos.every((v,i) => !v.paused && !v.seeking && v.currentTime > before[i] + 0.3) && Math.abs(videos[0].currentTime-videos[1].currentTime) < 0.15;
  }, resumeTimes, { timeout: 5000 });
  const convergedTimes = await main.evaluate(() => [...document.querySelectorAll('video')].map(v=>v.currentTime));
  await main.waitForTimeout(500);
  const resumeState = await main.evaluate(() => ({
    seeks: window.bufferingSeeks,
    trace: window.bufferingTrace,
    truncated: window.bufferingTraceTruncated,
    phaseCounts: window.bufferingPhaseSeeks['explicit-resume'] ?? {},
    videos: [...document.querySelectorAll('video')].map(v => ({time:v.currentTime,seeking:v.seeking,paused:v.paused})),
  }));
  console.log('Pause/resume seek trace:', resumeState);
  assert.ok(resumeState.seeks - resumeStartSeeks <= 2, 'resume has a bounded correction count');
  assert.ok(Object.values(resumeState.phaseCounts).every(count=>count<=1), 'resume permits at most one alignment correction per angle');
  assert.ok(resumeState.videos.every((v,i) => !v.paused && !v.seeking && v.time > resumeTimes[i] + 0.3 && v.time > convergedTimes[i] + 0.2), 'resumed angles keep progressing during observation');
  assert.ok(Math.abs(resumeState.videos[0].time-resumeState.videos[1].time) < 0.15, 'resumed angles remain synchronized');
  // A genuinely missing local source must fail independently and release its peer.
  await main.evaluate(() => {
    const video = document.querySelectorAll('video')[1];
    video.src = new URL('does-not-exist.mp4', video.currentSrc).href;
    video.load();
  });
  await main.waitForFunction(() =>
    Boolean(document.querySelectorAll('video')[1].error),
  );
  const beforeError = await main.evaluate(
    () => document.querySelector('video').currentTime,
  );
  await main.waitForFunction((before) => {
    const video = document.querySelector('video');
    return !video.paused && video.currentTime > before + 0.4;
  }, beforeError);
  console.log(
    'Missing local source raises a native error; healthy peer resumes',
  );
  console.log(
    `Both decoder waits hold all angles, recover and respect pause (${seeks} seeks)`,
  );
} catch (error) {
  let timer;
  try {
    const trace = await Promise.race([
      main?.evaluate(() => ({phase:window.bufferingPhase, trace:window.bufferingTrace, truncated:window.bufferingTraceTruncated, counts:window.bufferingPhaseSeeks})),
      new Promise(resolve => { timer = setTimeout(() => resolve('trace unavailable after 5s'), 5000); }),
    ]);
    console.error('Buffering failure trace:', trace);
  } catch { console.error('Buffering failure trace unavailable'); }
  finally { clearTimeout(timer); }
  throw error;
} finally {
  await app?.close().catch(() => undefined);
  await fs.rm(root, { recursive: true, force: true });
}
