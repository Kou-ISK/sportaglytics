import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'live-capture-'));
const artifacts = path.resolve(
  process.env.E2E_SCREENSHOT_DIR ?? 'output/playwright',
  'live-capture',
);
await fs.mkdir(artifacts, { recursive: true });
const pkg = path.join(root, 'live.stpkg');
const fixture = path.join(root, 'network.mp4');
const cameraFixture = path.join(root, 'camera.y4m');
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=1280x720:rate=30',
  '-t',
  '2',
  '-pix_fmt',
  'yuv420p',
  '-f',
  'yuv4mpegpipe',
  cameraFixture,
]);
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=blue:s=1280x720:r=30:d=12',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=880:duration=12',
  '-c:v',
  fixtureH264Encoder,
  '-g',
  '60',
  '-c:a',
  'aac',
  '-shortest',
  fixture,
]);
const feeds = new Map();
const server = createServer((request, response) => {
  if (request.url === '/unavailable.ts') {
    response.writeHead(503).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'video/mp2t' });
  const process = spawn(
    ffmpegPath,
    [
      '-v',
      'error',
      '-re',
      '-stream_loop',
      '-1',
      '-i',
      fixture,
      '-c',
      'copy',
      '-f',
      'mpegts',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
  );
  feeds.set(process, response);
  process.stdout.pipe(response);
  response.on('close', () => {
    process.kill();
    feeds.delete(process);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const url = `http://fixture:synthetic-password@127.0.0.1:${address.port}/live.ts`;
let app = await electron.launch(
  getElectronLaunchOptions(path.join(root, 'profile'), [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${cameraFixture}`,
  ]),
);
app.context().setDefaultTimeout(15000);
let capture;
let main;
let timeline;
const waitForCapture = async (predicate, timeout = 60000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await capture.evaluate(() =>
      window.electronAPI.liveCapture.getState(),
    );
    if (predicate(state)) return state;
    await delay(500);
  }
  throw new Error('Capture state did not reach expected condition');
};
const findWindow = async (fragment) => {
  for (let attempt = 0; attempt < 150; attempt++) {
    const found = app.windows().find((page) => page.url().includes(fragment));
    if (found) return found;
    await delay(100);
  }
  throw new Error(`Window did not open: ${fragment}`);
};
try {
  main = await app.firstWindow();
  main.on('pageerror', (error) =>
    console.error('Package renderer error:', error.message),
  );
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, pkg);
  await main
    .getByRole('button', { name: 'ライブキャプチャ', exact: true })
    .click();
  capture = await findWindow('#/live-capture');
  await capture
    .getByRole('button', { name: '録画を開始', exact: true })
    .waitFor();
  await capture
    .getByRole('button', { name: 'カメラ・音声を確認', exact: true })
    .click();
  await capture.getByLabel('録画画質', { exact: true }).click();
  await capture
    .getByRole('option', { name: '最大720p / 30fps', exact: true })
    .click();
  await capture.getByLabel('音声入力', { exact: true }).click();
  await capture
    .getByRole('option', { name: '既定の音声入力', exact: true })
    .click();
  assert.equal(
    await main.evaluate(() => window.electronAPI.liveCapture.getState()),
    null,
  );
  assert.equal(
    await main.evaluate(async () => {
      try {
        await window.electronAPI.liveCapture.authorizeDevices();
        return false;
      } catch {
        return true;
      }
    }),
    true,
    'a package renderer cannot obtain capture device permissions',
  );
  await capture
    .getByRole('button', { name: '映像入力を追加', exact: true })
    .click();
  await capture
    .getByRole('button', { name: 'IP映像', exact: true })
    .nth(1)
    .click();
  await capture.getByLabel('配信URL').fill(url);
  await capture
    .getByRole('button', { name: '映像入力を追加', exact: true })
    .click();
  await capture
    .getByRole('button', { name: 'IP映像', exact: true })
    .nth(2)
    .click();
  await capture
    .getByLabel('配信URL')
    .nth(1)
    .fill(`http://127.0.0.1:${address.port}/unavailable.ts`);
  assert.equal(
    await capture.evaluate(
      async () => (await window.electronAPI.liveCapture.capabilities()).network,
    ),
    true,
  );
  await capture.evaluate(() => {
    const Original = window.MediaRecorder;
    globalThis.captureRecorderStats = [];
    window.MediaRecorder = class extends Original {
      constructor(stream, options) {
        super(stream, options);
        const stats = {
          mime: this.mimeType,
          chunks: 0,
          bytes: 0,
          settings: stream.getVideoTracks().map((track) => ({
            width: track.getSettings().width,
            height: track.getSettings().height,
            frameRate: track.getSettings().frameRate,
          })),
        };
        globalThis.captureRecorderStats.push(stats);
        this.addEventListener('dataavailable', (event) => {
          stats.chunks++;
          stats.bytes += event.data.size;
        });
      }
    };
  });
  await capture
    .getByRole('button', { name: '録画を開始', exact: true })
    .click();
  await waitForCapture(
    (state) =>
      state?.inputs.length === 3 &&
      state.inputs.slice(0, 2).every((input) => input.segmentCount >= 5) &&
      state.inputs[2].phase === 'disconnected',
  );
  console.log(
    'USB fake camera and HTTP input record with audio; an unavailable input does not block coding',
  );
  await main.locator('#video_0 video').waitFor({ timeout: 20000 });
  timeline = await findWindow('#/timeline');
  console.log(
    'Package capture access:',
    Boolean(
      await main.evaluate(() => window.electronAPI.liveCapture.getState()),
    ),
  );
  await timeline.evaluate(() => {
    window.electronAPI.timelineWindow.sendCommand({ type: 'request-sync' });
  });
  await timeline
    .getByRole('button', { name: 'ライブ位置', exact: true })
    .waitFor();
  await timeline.evaluate(() => {
    globalThis.captureClock = null;
    window.electronAPI.timelineWindow.onClock((clock) => {
      globalThis.captureClock = clock;
    });
    window.electronAPI.timelineWindow.sendCommand({ type: 'request-sync' });
  });
  // Review/coding uses the saved package clock, across several physical recording segments.
  const pause = main.getByRole('button', { name: '一時停止', exact: true });
  if (await pause.count()) await pause.click({ force: true });
  const seek = async (time) => {
    await timeline.evaluate(
      (value) =>
        window.electronAPI.timelineWindow.sendCommand({
          type: 'seek',
          time: value,
        }),
      time,
    );
    await timeline.waitForFunction(
      (value) => Math.abs(globalThis.captureClock?.currentTime - value) < 0.02,
      time,
    );
  };
  await seek(3);
  await delay(2500);
  assert.ok(
    Math.abs(
      (await timeline.evaluate(() => globalThis.captureClock?.currentTime)) - 3,
    ) < 0.05,
    'recording growth must not move a paused review cursor',
  );
  await capture.evaluate(() =>
    window.electronAPI.codingPanelWindow.openWindow(),
  );
  const code = await findWindow('#/coding-panel');
  await code.getByRole('button', { name: 'コード', exact: true }).waitFor();
  await code.evaluate(() => {
    window.electronAPI.codingPanelWindow.sendCommand({
      type: 'layout-updated',
      layout: {
        id: 'capture-code',
        name: 'Capture code',
        canvasWidth: 400,
        canvasHeight: 200,
        buttons: [
          {
            id: 'event',
            type: 'action',
            name: 'Live event',
            x: 20,
            y: 20,
            width: 150,
            height: 60,
            hotkey: 'Q',
          },
        ],
      },
    });
    window.electronAPI.codingPanelWindow.sendCommand({
      type: 'set-mode',
      mode: 'code',
    });
  });
  const button = code.locator('[data-code-window-button="event"]');
  await button.waitFor();
  await timeline
    .getByRole('button', { name: 'ライブ位置', exact: true })
    .click();
  await timeline.waitForFunction(() => globalThis.captureClock?.isPlaying);
  await main.waitForFunction(() => {
    const video = document.querySelector('#video_0 video');
    return video?.readyState >= 3 && !video.seeking && !video.paused;
  });
  await delay(750);
  await main.evaluate(() => {
    globalThis.initialCaptureVideo = document.querySelector('#video_0 video');
    globalThis.initialCaptureTime = globalThis.initialCaptureVideo.currentTime;
    globalThis.captureWaiting = 0;
    globalThis.captureWaits = [];
    globalThis.captureEmptied = 0;
    globalThis.initialCaptureVideo?.addEventListener('waiting', () => {
      globalThis.captureWaiting++;
      globalThis.captureWaits.push({
        time: globalThis.initialCaptureVideo.currentTime,
        seeking: globalThis.initialCaptureVideo.seeking,
        ranges: Array.from(
          { length: globalThis.initialCaptureVideo.buffered.length },
          (_, i) => [
            globalThis.initialCaptureVideo.buffered.start(i),
            globalThis.initialCaptureVideo.buffered.end(i),
          ],
        ),
      });
    });
    globalThis.initialCaptureVideo?.addEventListener(
      'emptied',
      () => globalThis.captureEmptied++,
    );
  });
  await code.bringToFront();
  await button.click();
  await button.locator('svg').waitFor();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) =>
          window.webContents.getURL().includes('#/live-capture'),
        )
        ?.isVisible(),
    ),
    false,
    'capture controls stay hidden while coding',
  );
  await app.evaluate(({ BrowserWindow }, url) => {
    BrowserWindow.getAllWindows()
      .find((window) => window.webContents.getURL() === url)
      ?.hide();
  }, main.url());
  const liveStart = await timeline.evaluate(
    () => globalThis.captureClock.currentTime,
  );
  await delay(25000);
  await code.keyboard.press('q');
  await button.locator('svg').waitFor({ state: 'detached' });
  await app.evaluate(({ BrowserWindow }, url) => {
    BrowserWindow.getAllWindows()
      .find((window) => window.webContents.getURL() === url)
      ?.showInactive();
  }, main.url());
  const liveEnd = await timeline.evaluate(
    () => globalThis.captureClock.currentTime,
  );
  const playback = await main.evaluate(() => ({
    sameElement:
      globalThis.initialCaptureVideo ===
      document.querySelector('#video_0 video'),
    source: document
      .querySelector('#video_0 video')
      ?.currentSrc?.startsWith('blob:'),
    emptied: globalThis.captureEmptied,
    waiting: globalThis.captureWaiting,
    playedSeconds:
      document.querySelector('#video_0 video').currentTime -
      globalThis.initialCaptureTime,
    waits: globalThis.captureWaits,
    error: document.querySelector('#video_0 video')?.error?.message,
  }));
  console.log('Continuous live playback:', JSON.stringify(playback));
  assert.ok(
    liveEnd - liveStart > 20,
    'package clock advances while coding is focused',
  );
  assert.equal(
    playback.sameElement,
    true,
    'a segment boundary must not recreate the decoder',
  );
  assert.equal(
    playback.source,
    true,
    'live recording uses one continuous MediaSource',
  );
  assert.equal(playback.emptied, 0);
  assert.equal(
    playback.waiting,
    0,
    'buffered live playback must not stall at segment boundaries',
  );
  assert.ok(
    playback.playedSeconds > 20,
    'the video advances while its window is hidden',
  );
  assert.equal(playback.error, undefined);
  // Keep the live regression instance, then verify exact paused review timestamps.
  await timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({ type: 'request-sync' }),
  );
  await main
    .getByRole('button', { name: '一時停止', exact: true })
    .click({ force: true });
  await seek(3);
  await code.bringToFront();
  await code.keyboard.press('q');
  await button.locator('svg').waitFor();
  await seek(8);
  await button.click();
  await button.locator('svg').waitFor({ state: 'detached' });
  let document;
  for (let attempt = 0; attempt < 100; attempt++) {
    document = JSON.parse(
      await fs.readFile(path.join(pkg, 'timeline.json'), 'utf8'),
    );
    if (document.instances?.length === 2) break;
    await delay(100);
  }
  assert.equal(document.instances.length, 2);
  assert.equal(document.instances[1].startTime, 3);
  assert.equal(document.instances[1].endTime, 8);
  console.log(
    'Live Code Window persisted a cross-segment instance on the standard Timeline clock',
  );
  const current = await capture.evaluate(() =>
    window.electronAPI.liveCapture.getState(),
  );
  assert.ok(
    !JSON.stringify(current).includes('synthetic-password'),
    'credentials never enter capture snapshots',
  );
  // Interrupt one source while the other continues, then restore it with a preserved gap.
  for (const [process, response] of feeds) {
    response.destroy();
    process.kill();
  }
  await waitForCapture(
    (state) => state?.inputs[1].phase === 'disconnected',
    25000,
  );
  await delay(1500);
  await timeline
    .getByRole('button', { name: '録画の操作', exact: true })
    .click();
  const countBeforeHide = (
    await capture.evaluate(() => window.electronAPI.liveCapture.getState())
  ).inputs[0].segmentCount;
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((window) => window.webContents.getURL().includes('#/live-capture'))
      ?.close(),
  );
  await waitForCapture(
    (state) => state?.inputs[0].segmentCount > countBeforeHide,
  );
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) =>
          window.webContents.getURL().includes('#/live-capture'),
        )
        ?.isVisible(),
    ),
    false,
  );
  await timeline
    .getByRole('button', { name: '録画の操作', exact: true })
    .click();
  await capture
    .getByRole('button', { name: '再接続', exact: true })
    .first()
    .click();
  await waitForCapture(
    (state) =>
      state?.mediaAngles[1].clips.some((clip) =>
        clip.source.includes('take-1'),
      ),
    40000,
  );
  await timeline
    .getByRole('button', { name: 'ライブ位置', exact: true })
    .click();
  await timeline.waitForFunction(
    () => globalThis.captureClock?.currentTime > 10,
  );
  await capture
    .getByRole('button', { name: '停止して保存', exact: true })
    .click();
  await capture
    .getByText(
      '録画を保存しました。通常のパッケージとして再生・編集・書き出しできます。',
    )
    .waitFor({ timeout: 30000 });
  const configText = await fs.readFile(
    path.join(pkg, '.metadata/config.json'),
    'utf8',
  );
  assert.ok(
    !configText.includes('synthetic-password') &&
      !configText.includes('127.0.0.1'),
    'network addresses and credentials are never persisted',
  );
  const config = JSON.parse(configText);
  assert.equal(config.liveCapture.phase, 'completed');
  assert.equal(config.angles.length, 2);
  for (const angle of config.angles) {
    assert.ok(angle.clips.length >= 5);
    for (const clip of angle.clips) {
      const media = JSON.parse(
        execFileSync(
          ffprobePath,
          [
            '-v',
            'error',
            '-show_format',
            '-show_streams',
            '-of',
            'json',
            path.join(pkg, clip.relativePath),
          ],
          { encoding: 'utf8' },
        ),
      );
      assert.ok(media.streams.some((stream) => stream.codec_name === 'h264'));
      assert.ok(media.streams.some((stream) => stream.codec_name === 'aac'));
      assert.ok(Number(media.format.duration) > 0);
    }
  }
  const clips = config.angles[1].clips;
  const resumed = clips.findIndex((clip) =>
    clip.relativePath.includes('take-1'),
  );
  assert.ok(resumed > 0);
  assert.ok(
    clips[resumed].timelineStartSeconds >
      clips[resumed - 1].timelineStartSeconds +
        clips[resumed - 1].durationSeconds +
        1,
    'reconnection preserves the missing period',
  );
  // Finished capture is the same portable document used by normal playback/export.
  const output = path.join(root, 'output');
  await fs.mkdir(output);
  const result = await main.evaluate(
    async ({ source, output }) =>
      window.electronAPI.exportClipsWithOverlay({
        progressId: 'live-export',
        sourcePath: source,
        outputDir: output,
        outputFileName: 'live-review',
        mode: 'single',
        exportMode: 'single',
        angleOption: 'single',
        clips: [
          { id: 'event', actionName: 'Live event', startTime: 3, endTime: 8 },
        ],
        overlay: {
          enabled: false,
          showActionName: false,
          showActionIndex: false,
          showLabels: false,
          showMemo: false,
        },
      }),
    { source: path.join(pkg, config.angles[0].clips[0].relativePath), output },
  );
  assert.equal(result.success, true, result.error);
  const exported = JSON.parse(
    execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_format',
        '-of',
        'json',
        path.join(output, 'live-review_angle1.mp4'),
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(
    Math.abs(Number(exported.format.duration) - 5) < 0.15,
    'coded interval exports across capture segments',
  );

  console.log(
    'Capture stop, source reconnection gap, playable H.264 segments and portable metadata passed',
  );
  await capture.screenshot({
    path: path.join(artifacts, 'capture-completed.png'),
  });
  await (
    await app.browserWindow(capture)
  ).evaluate((window) => window.setSize(680, 520));
  await capture.screenshot({
    path: path.join(artifacts, 'capture-narrow.png'),
  });
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
  });
  await app.close();
  capture = undefined;
  timeline = undefined;
  app = await electron.launch(
    getElectronLaunchOptions(path.join(root, 'profile'), [pkg]),
  );
  app.context().setDefaultTimeout(15000);
  main = await app.firstWindow();
  await main.locator('#video_0 video').waitFor({ timeout: 30000 });
  timeline = await findWindow('#/timeline');
  await timeline
    .getByTestId(`timeline-instance-${document.instances[0].id}`)
    .waitFor();
  assert.equal(
    await main.evaluate(() => window.electronAPI.liveCapture.getState()),
    null,
    'reopened capture is an ordinary saved package',
  );
  console.log(
    'Saved capture reopened with its coded interval and playable source',
  );
  console.log('Live capture E2E passed');
} catch (error) {
  if (timeline) {
    console.error(
      'Timeline failure:',
      await timeline
        .locator('body')
        .innerText()
        .catch(() => 'closed'),
    );
    await timeline
      .screenshot({ path: path.join(artifacts, 'timeline-failure.png') })
      .catch(() => undefined);
  }
  if (main) {
    console.error(
      'Package view:',
      await main
        .locator('body')
        .innerText()
        .catch(() => 'closed'),
    );
    console.error(
      'Package state:',
      await main
        .evaluate(async () => ({
          capture: (await window.electronAPI.liveCapture.getState())?.phase,
          videos: [...document.querySelectorAll('video')].map((video) => ({
            time: video.currentTime,
            source: video.currentSrc.split('/').pop(),
            ready: video.readyState,
          })),
          windows: location.hash,
        }))
        .catch(() => null),
    );
    await main
      .screenshot({ path: path.join(artifacts, 'package-failure.png') })
      .catch(() => undefined);
  }
  if (capture) {
    console.error(
      'Recorder stats:',
      await capture
        .evaluate(() => globalThis.captureRecorderStats)
        .catch(() => null),
    );
    const state = await capture
      .evaluate(() => window.electronAPI.liveCapture.getState())
      .catch(() => null);
    console.error(
      'Capture status:',
      state && {
        phase: state.phase,
        inputs: state.inputs,
        message: state.message,
      },
    );
    await capture
      .screenshot({ path: path.join(artifacts, 'capture-failure.png') })
      .catch(() => undefined);
    console.error(
      'Capture visible error:',
      await capture
        .getByRole('alert')
        .allTextContents()
        .catch(() => []),
    );
  }
  throw error;
} finally {
  if (capture)
    await capture
      .evaluate(async () => {
        const state = await window.electronAPI.liveCapture.getState();
        if (state) await window.electronAPI.liveCapture.stop(state.id);
      })
      .catch(() => undefined);
  await app
    .evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) window.destroy();
    })
    .catch(() => undefined);
  await app.close();
  for (const [process, response] of feeds) {
    response.destroy();
    process.kill();
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  // Fixtures are deliberately synthetic; retain them only for a failed local run.
  if (!process.env.KEEP_E2E_ARTIFACTS)
    await fs.rm(root, { recursive: true, force: true });
}
