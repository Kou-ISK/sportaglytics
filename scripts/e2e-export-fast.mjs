import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';

const dir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-fast-export-'),
);
const pkg = path.join(dir, 'sample.stpkg');
await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
const sources = ['blue', 'red'].map((color) => {
  const file = path.join(pkg, `${color}.mp4`);
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=1280x720:r=30:d=8`,
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=880:sample_rate=48000:duration=8',
    '-c:v',
    fixtureH264Encoder,
    '-b:v',
    '5M',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    file,
  ]);
  return file;
});
const config = {
  primaryAngleId: 'one',
  angles: [
    {
      id: 'one',
      sourceKind: 'local',
      relativePath: 'blue.mp4',
      clips: sources.map((file, i) => ({
        id: `clip-${i}`,
        sourceKind: 'local',
        relativePath: path.basename(file),
        durationSeconds: 8,
        timelineStartSeconds: i * 8,
      })),
    },
  ],
};
const configPath = path.join(pkg, '.metadata/config.json');
await fs.writeFile(configPath, JSON.stringify(config));
const output = path.join(dir, 'output');
await fs.mkdir(output);
const app = await electron.launch(
  getElectronLaunchOptions(path.join(dir, 'profile')),
);
let diagnostics = '';
app.process().stdout?.on('data', (data) => {
  diagnostics += data.toString();
});
app.process().stderr?.on('data', (data) => {
  diagnostics += data.toString();
});
const frameHashes = (file) =>
  execFileSync(
    ffmpegPath,
    ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'framemd5', '-'],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  )
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(',').at(-1).trim());
const duration = (file) =>
  Number(
    execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        file,
      ],
      { encoding: 'utf8' },
    ),
  );
const pixel = (file, time) => [
  ...execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-ss',
    String(time),
    '-i',
    file,
    '-frames:v',
    '1',
    '-vf',
    'scale=1:1',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-',
  ]),
];
try {
  const page = await app.firstWindow();
  const run = async (
    name,
    start,
    end,
    overlay = false,
    ranges = [[start, end]],
  ) => {
    const begun = performance.now();
    const result = await page.evaluate(
      async ({ source, output, name, ranges, overlay }) =>
        window.electronAPI.exportClipsWithOverlay({
          progressId: name,
          sourcePath: source,
          outputDir: output,
          outputFileName: name,
          mode: 'single',
          exportMode: 'single',
          angleOption: 'single',
          clips: ranges.map(([startTime, endTime], index) => ({
            id: `${name}-${index}`,
            actionName: 'Review',
            startTime,
            endTime,
          })),
          overlay: {
            enabled: overlay,
            showActionName: true,
            showActionIndex: false,
            showLabels: false,
            showMemo: false,
          },
        }),
      { source: sources[0], output, name, ranges, overlay },
    );
    assert.equal(result.success, true, result.error);
    return {
      file: path.join(output, `${name}_angle1.mp4`),
      seconds: (performance.now() - begun) / 1000,
    };
  };
  const progressPromise = app.waitForEvent('window');
  const fast = await run('original', 0, 16);
  const progress = await progressPromise;
  const fastDiagnostics = diagnostics;
  assert.ok(
    fastDiagnostics.includes("operation: 'stream-copy'"),
    'compatible movies must use stream copy',
  );
  assert.ok(
    !fastDiagnostics.includes("operation: 'encode'"),
    'plain compatible full movies must never be re-encoded',
  );
  assert.deepEqual(
    frameHashes(fast.file),
    [...frameHashes(sources[0]), ...frameHashes(sources[1])],
    'every decoded source frame must be preserved',
  );
  assert.ok(Math.abs(duration(fast.file) - 16) < 0.01);
  const videoStart = Number(
    execFileSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=start_time',
        '-of',
        'default=nw=1:nk=1',
        fast.file,
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(
    Math.abs(videoStart) < 0.001,
    'AAC priming must not shift the video clock',
  );

  const encoded = await run('overlay', 0, 16, true);
  console.log(
    `Synthetic 16-second export: original=${fast.seconds.toFixed(2)}s, overlay=${encoded.seconds.toFixed(2)}s`,
  );
  await progress.evaluate(() => {
    globalThis.__exportSamples = [];
    window.electronAPI.onExportProgressWindowState((state) =>
      globalThis.__exportSamples.push(state),
    );
  });
  config.angles[0].clips[1].timelineStartSeconds = 12;
  await fs.writeFile(configPath, JSON.stringify(config));
  const gapped = await run('gapped', 6, 14);
  assert.ok(
    Math.abs(duration(gapped.file) - 8) < 0.15,
    'only the requested interval may be prepared',
  );
  assert.ok(pixel(gapped.file, 1)[2] > 200);
  assert.ok(pixel(gapped.file, 3).every((value) => value < 8));
  assert.ok(pixel(gapped.file, 7)[0] > 200);
  const samples = await progress.evaluate(() => globalThis.__exportSamples);
  assert.ok(
    samples.some(
      (state) =>
        state.id === 'gapped' &&
        state.message.includes('同期区間を準備中') &&
        state.current > 0 &&
        state.current < state.total,
    ),
    'preparation must advance visible progress',
  );
  const values = samples
    .filter((state) => state.id === 'gapped')
    .map((state) => state.current / state.total);
  assert.ok(
    values.every((value, i) => i === 0 || value >= values[i - 1]),
    'progress must never go backwards',
  );
  assert.ok(
    diagnostics.includes("operation: 'encode'"),
    'gaps and overlays must retain the render fallback',
  );
  const late = await run('late', 14.25, 15.25);
  assert.ok(Math.abs(duration(late.file) - 1) < 0.1);
  assert.ok(
    pixel(late.file, 0.5)[0] > 200,
    'a late clip must use the second source local clock',
  );
  const logStart = diagnostics.length;
  const sparse = await run('sparse', 0.5, 1.5, true, [
    [0.5, 1.5],
    [14, 15],
  ]);
  const sparseLog = diagnostics.slice(logStart);
  assert.equal(
    (sparseLog.match(/operation: 'encode'/g) ?? []).length,
    2,
    'encode only the two selected clips, not the unselected middle interval',
  );
  assert.ok(Math.abs(duration(sparse.file) - 2) < 0.1);
  assert.ok(pixel(sparse.file, 0.4)[2] > 190);
  assert.ok(pixel(sparse.file, 1.4)[0] > 190);
  console.log(
    'Sparse overlay clips bypass preparation and preserve order, source clocks and duration',
  );
  console.log(
    'Lossless concat, exact late trims, black gaps and preparation progress passed',
  );
} catch (error) {
  console.error(diagnostics.slice(-8000));
  throw error;
} finally {
  await app.close().catch(() => undefined);
  await fs.rm(dir, { recursive: true, force: true });
}
