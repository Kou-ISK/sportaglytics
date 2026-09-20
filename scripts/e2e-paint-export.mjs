// Real Canvas -> shared export service -> validated Electron IPC -> FFmpeg.
// All footage and annotations are synthetic; no private media is required.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';

const work = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-paint-export-'),
);
const output = path.join(work, 'exports');
await fs.mkdir(output);
const sources = [path.join(work, 'main.mp4'), path.join(work, 'secondary.mp4')];
for (const [index, source] of sources.entries()) {
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    index === 0
      ? 'color=c=0x008000:s=320x180:r=30:d=6,drawbox=x=90:y=80:w=24:h=70:color=white:t=fill'
      : 'color=c=blue:s=160x120:r=30:d=6',
    ...(index === 0
      ? ['-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=6']
      : []),
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-y',
    source,
  ]);
}
const bundled = await build({
  stdin: {
    contents: `
    export { buildPlaylistExportClips } from './src/features/playlist/utils/playlistClipExportBuilder';
    export { renderAnnotationPng } from './src/features/playlist/utils/renderAnnotationPng';
    export { executeClipExport } from './src/shared/clipExport/clipExportService';
  `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'PaintExportFixture',
  platform: 'browser',
});
const app = await electron.launch(
  getElectronLaunchOptions(path.join(work, 'profile')),
);
let diagnostics = '';
app.process().stderr?.on('data', (data) => {
  diagnostics = (diagnostics + data.toString()).slice(-12000);
});
const probe = (file) =>
  JSON.parse(
    execFileSync(
      ffprobePath,
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
      { encoding: 'utf8' },
    ),
  );
const pixel = (file, time, x, y) => {
  const info = probe(file).streams.find(
    (stream) => stream.codec_type === 'video',
  );
  const frame = execFileSync(
    ffmpegPath,
    [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      file,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const offset = (y * info.width + x) * 3;
  return [...frame.subarray(offset, offset + 3)];
};
const expectColor = (file, time, x, y, color, name) => {
  const actual = pixel(file, time, x, y);
  assert.ok(
    actual.length === 3 &&
      actual.every((value, i) => Math.abs(value - color[i]) < 25),
    `${name}: expected ${color}, received ${actual}`,
  );
};
const audioRms = (file, time) => {
  const samples = execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-ss',
    String(time),
    '-i',
    file,
    '-t',
    '0.15',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '48000',
    '-f',
    'f32le',
    '-',
  ]);
  let squares = 0;
  for (let i = 0; i < samples.length; i += 4)
    squares += samples.readFloatLE(i) ** 2;
  return Math.sqrt(squares / (samples.length / 4));
};
try {
  const page = await app.firstWindow({ timeout: 30000 });
  page.setDefaultTimeout(30000);
  await page.waitForFunction(() =>
    Boolean(window.electronAPI?.exportClipsWithOverlay),
  );
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const exportCase = async (name, angleOption, staticOnly = false) => {
    const result = await page.evaluate(
      async ({ name, angleOption, staticOnly, sources, output }) => {
        const {
          buildPlaylistExportClips,
          renderAnnotationPng,
          executeClipExport,
        } = PaintExportFixture;
        const rectangle = {
          type: 'rectangle',
          color: '#ff0000',
          strokeWidth: 2,
          fill: true,
          opacity: 1,
          startX: 30,
          startY: 120,
          endX: 70,
          endY: 145,
          baseWidth: 320,
          baseHeight: 180,
        };
        const still = {
          ...rectangle,
          id: 'still',
          color: '#ffff00',
          startX: 160,
          endX: 190,
          startY: 20,
          endY: 50,
          timestamp: 3,
        };
        const objects = staticOnly
          ? [
              { ...still, id: 'initial', timestamp: 2 },
              { ...still, id: 'later', timestamp: 4, color: '#00ffff' },
            ]
          : [
              {
                ...rectangle,
                id: 'tracked',
                timestamp: 0,
                motion: {
                  duration: 6,
                  keyframes: [
                    { time: 0, x: 0, y: 0 },
                    { time: 6, x: 120, y: 0 },
                  ],
                },
              },
              still,
              {
                ...rectangle,
                id: 'secondary',
                target: 'secondary',
                color: '#ff00ff',
                startX: 20,
                endX: 40,
                startY: 30,
                endY: 50,
                baseWidth: 160,
                baseHeight: 120,
                timestamp: 0,
                motion: {
                  duration: 6,
                  keyframes: [
                    { time: 0, x: 0, y: 0 },
                    { time: 6, x: 60, y: 0 },
                  ],
                },
              },
            ];
        const clips = buildPlaylistExportClips({
          sourceItems: [
            {
              id: 'synthetic',
              timelineItemId: null,
              actionName: 'Paint fixture',
              addedAt: 0,
              videoSource: sources[0],
              videoSource2: sources[1],
              startTime: 2,
              endTime: 5,
              annotation: {
                objects,
                freezeDuration: 1,
                freezeAt: 3,
                chromaKey: staticOnly
                  ? undefined
                  : {
                      primary: {
                        color: '#008000',
                        similarity: 0.1,
                        blend: 0.02,
                      },
                    },
              },
            },
          ],
          itemAnnotations: {},
          minFreezeDuration: 1,
          primaryContentRect: {
            width: 320,
            height: 180,
            offsetX: 0,
            offsetY: 0,
          },
          secondaryContentRect: {
            width: 160,
            height: 120,
            offsetX: 0,
            offsetY: 0,
          },
          primarySourceSize: { width: 320, height: 180 },
          secondarySourceSize: { width: 160, height: 120 },
          renderAnnotationPng,
        });
        return executeClipExport({
          executeExport: (payload) =>
            window.electronAPI.exportClipsWithOverlay({
              ...payload,
              outputDir: output,
            }),
          clips,
          videoSources: sources,
          angleOption,
          selectedAngleIndex: 0,
          resolvedSources: { sourcePath: sources[0], sourcePath2: sources[1] },
          exportMode:
            angleOption === 'allAngles'
              ? 'perInstance'
              : staticOnly
                ? 'perRow'
                : 'single',
          exportFileName: name,
          overlay: {
            enabled: false,
            showActionName: false,
            showActionIndex: false,
            showLabels: false,
            showMemo: false,
          },
          successMessage: 'done',
        });
      },
      { name, angleOption, staticOnly, sources, output },
    );
    assert.ok(result.success, result.message);
  };
  await exportCase('tracked', 'allAngles');
  let files = await fs.readdir(output);
  const primary = path.join(
    output,
    files.find((file) => file.startsWith('tracked_angle1')),
  );
  const secondary = path.join(
    output,
    files.find((file) => file.startsWith('tracked_angle2')),
  );
  for (const [file, width, height] of [
    [primary, 320, 180],
    [secondary, 160, 120],
  ]) {
    const info = probe(file);
    const video = info.streams.find((stream) => stream.codec_type === 'video');
    assert.deepEqual([video.width, video.height], [width, height]);
    assert.ok(
      Math.abs(Number(info.format.duration) - 4) < 0.15,
      `unexpected duration ${info.format.duration}`,
    );
    assert.ok(info.streams.some((stream) => stream.codec_type === 'audio'));
  }
  expectColor(
    primary,
    0.3,
    80,
    130,
    [77, 90, 0],
    'trimmed motion starts at interpolated position',
  );
  expectColor(
    primary,
    0.3,
    100,
    130,
    [255, 255, 255],
    'player remains in front of Paint',
  );
  expectColor(
    primary,
    1.5,
    175,
    30,
    [77, 166, 0],
    'still drawing remains visible throughout freeze',
  );
  expectColor(
    primary,
    2.6,
    135,
    130,
    [77, 90, 0],
    'tracking resumes after freeze',
  );
  expectColor(
    primary,
    2.6,
    80,
    130,
    [0, 128, 0],
    'old tracked position clears',
  );
  expectColor(
    primary,
    2.6,
    175,
    30,
    [0, 128, 0],
    'still drawing clears after freeze',
  );
  expectColor(
    secondary,
    0.3,
    10,
    10,
    [0, 0, 255],
    'second angle uses second video',
  );
  expectColor(
    secondary,
    0.3,
    48,
    40,
    [77, 0, 255],
    'second angle uses second Paint',
  );
  assert.ok(audioRms(primary, 0.3) > 0.03, 'source audio survives export');
  assert.ok(audioRms(primary, 1.4) < 0.002, 'freeze inserts silence');
  assert.ok(audioRms(primary, 2.6) > 0.03, 'audio resumes after freeze');
  assert.ok(audioRms(secondary, 0.3) < 0.002, 'silent angle stays silent');
  console.log(
    'Paint tracking, trim, foreground, freeze, angle selection and audio passed',
  );

  await exportCase('dual', 'multi');
  files = await fs.readdir(output);
  const dual = path.join(
    output,
    files.find((file) => file.startsWith('dual')),
  );
  const dualVideo = probe(dual).streams.find(
    (stream) => stream.codec_type === 'video',
  );
  assert.deepEqual([dualVideo.width, dualVideo.height], [560, 180]);
  expectColor(dual, 0.3, 80, 130, [77, 90, 0], 'dual primary Paint');
  expectColor(
    dual,
    0.3,
    392,
    60,
    [77, 0, 255],
    'dual secondary Paint scales with video',
  );
  console.log('Paint mixed-resolution dual export passed');

  await exportCase('static', 'single', true);
  files = await fs.readdir(output);
  const still = path.join(
    output,
    files.find((file) => file.startsWith('static')),
  );
  assert.ok(Math.abs(Number(probe(still).format.duration) - 5) < 0.15);
  expectColor(still, 0.5, 175, 30, [77, 166, 0], 'freeze at clip start');
  expectColor(still, 2, 175, 30, [0, 128, 0], 'between freeze frames');
  expectColor(still, 3.5, 175, 30, [0, 166, 77], 'second freeze frame');
  console.log('Paint static multi-frame and row export passed');
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await fs.cp(
      output,
      path.join(process.env.E2E_SCREENSHOT_DIR, 'paint-exports'),
      { recursive: true },
    );
  }
} catch (error) {
  console.error(diagnostics);
  throw error;
} finally {
  await app.close().catch(() => undefined);
  await fs.rm(work, { recursive: true, force: true });
}
