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

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-gaps-'));
let app;
try {
  for (const scenario of [
    { name: 'natural', audio: 2 },
    { name: 'drift', audio: 2, drift: 0.09 },
    { name: 'short-audio', audio: 1.8 },
    { name: 'explicit-gap', audio: 2, seekGap: true },
  ]) {
    const pkg = path.join(root, `${scenario.name}.stpkg`);
    await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
    await fs.mkdir(path.join(pkg, 'media'));
    execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=160x90:rate=30:duration=2',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${scenario.audio}`,
      '-threads',
      '1',
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
      path.join(pkg, 'media/0.mp4'),
    ]);
    await fs.copyFile(
      path.join(pkg, 'media/0.mp4'),
      path.join(pkg, 'media/1.mp4'),
    );
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
            clips: [0, 1].map((i) => ({
              id: `clip-${i}`,
              sourceKind: 'local',
              relativePath: `media/${i}.mp4`,
              gapBeforeSeconds: i ? 2 : 0,
              timelineStartSeconds: i * 4,
              durationSeconds: 2,
            })),
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
    await fs.writeFile(
      path.join(pkg, 'timeline.json'),
      JSON.stringify({
        version: 2,
        rows: [{ id: 'row', name: 'Event', color: '#123456' }],
        instances: [],
      }),
    );
    app = await electron.launch(
      getElectronLaunchOptions(path.join(root, `profile-${scenario.name}`)),
    );
    observeElectronErrors(app);
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
      () => document.querySelector('video')?.readyState >= 3,
    );
    assert.ok(
      await main.evaluate(() =>
        document.querySelector('video').currentSrc.startsWith('blob:'),
      ),
      'exercise the actual MSE path, not a file fallback',
    );
    await main.evaluate(() => window.electronAPI.timelineWindow.openWindow());
    let timeline;
    for (let i = 0; i < 100; i++) {
      timeline = app.windows().find((w) => w.url().includes('#/timeline'));
      if (timeline) break;
      await main.waitForTimeout(50);
    }
    assert.ok(timeline);
    await timeline.getByTestId('timeline-ruler').waitFor();
    await timeline.evaluate(() =>
      window.electronAPI.timelineWindow.sendCommand({
        type: 'seek',
        time: 1.5,
      }),
    );
    await main.waitForFunction(() => {
      const video = document.querySelector('video');
      return Math.abs(video.currentTime - 1.5) < 0.04 && !video.seeking;
    });
    await main.evaluate(() => {
      window.captureGapSeeks = [];
      document.querySelector('video').addEventListener('seeking', (event) => {
        window.captureGapSeeks.push(event.target.currentTime);
      });
    });
    if (scenario.seekGap) {
      await timeline.evaluate(() =>
        window.electronAPI.timelineWindow.sendCommand({
          type: 'seek',
          time: 3,
        }),
      );
      await timeline.waitForFunction(
        () =>
          Number(
            document
              .querySelector('[aria-label="タイムラインの再生位置"]')
              ?.getAttribute('aria-valuenow'),
          ) === 3,
      );
      await main.waitForTimeout(300);
      assert.equal(
        await timeline
          .getByRole('slider', { name: 'タイムラインの再生位置' })
          .getAttribute('aria-valuenow'),
        '3',
        'the explicit seek reached the gap and remains paused there',
      );
      await main.getByRole('button', { name: '再生', exact: true }).waitFor();
      assert.deepEqual(
        await main.evaluate(() => window.captureGapSeeks),
        [],
        'a paused explicit gap seek must not request a nonexistent frame',
      );
    }
    await timeline.keyboard.press('Space');
    if (scenario.drift) {
      await main.waitForFunction(() => {
        const video = document.querySelector('video');
        return !video.paused && video.currentTime > 1.6;
      });
      await main.evaluate((drift) => {
        document.querySelector('video').currentTime += drift;
      }, scenario.drift);
    }
    await main.waitForFunction(
      () => {
        const video = document.querySelector('video');
        return !video.paused && !video.seeking && video.currentTime > 4.2;
      },
      undefined,
      { timeout: 10000 },
    );
    await main.waitForFunction(
      () => {
        const video = document.querySelector('video');
        return video.paused && !video.seeking && video.currentTime > 5.7;
      },
      undefined,
      { timeout: 10000 },
    );
    await timeline.waitForFunction(
      () =>
        Number(
          document
            .querySelector('[aria-label="タイムラインの再生位置"]')
            ?.getAttribute('aria-valuenow'),
        ) === 6,
    );
    await main.getByRole('button', { name: '再生', exact: true }).waitFor();
    const seeks = await main.evaluate(() => window.captureGapSeeks);
    assert.ok(
      seeks.every((time) => time < 2 || time >= 4),
      `never seek into the recording gap: ${JSON.stringify(seeks)}`,
    );
    assert.ok(seeks.length <= 4, `no seek loop: ${JSON.stringify(seeks)}`);
    console.log(
      `Capture gap ${scenario.name}: resumed and reached package end`,
    );
    await app.close();
    app = undefined;
  }
} finally {
  await app?.close().catch(() => undefined);
  await fs.rm(root, { recursive: true, force: true });
}
