import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';

// Synthetic footage only. Reuse the directory to compare the same inputs across builds.
const root = path.resolve(
  process.argv[2] ?? 'output/benchmarks/overlay-export',
);
const label = process.argv[3] ?? 'current';
assert.match(label, /^[a-z0-9-]+$/);
const pkg = path.join(root, 'synthetic.stpkg');
await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
const original = path.join(root, 'original.mp4');
try {
  await fs.access(original);
} catch {
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=s=1280x720:r=30:d=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=880:sample_rate=48000:duration=30',
    '-c:v',
    fixtureH264Encoder,
    '-b:v',
    '12M',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    original,
  ]);
}
const sources = ['first.mp4', 'second.mp4'].map((name) => path.join(pkg, name));
for (const file of sources) await fs.copyFile(original, file);
await fs.writeFile(
  path.join(pkg, '.metadata/config.json'),
  JSON.stringify({
    primaryAngleId: 'one',
    angles: [
      {
        id: 'one',
        sourceKind: 'local',
        relativePath: 'first.mp4',
        clips: sources.map((file, i) => ({
          id: `source-${i}`,
          sourceKind: 'local',
          relativePath: path.basename(file),
          durationSeconds: 30,
          timelineStartSeconds: i * 120,
        })),
      },
    ],
  }),
);
const paint = path.join(root, 'paint.png');
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=black@0:s=1280x720,format=rgba,drawbox=x=200:y=420:w=160:h=80:color=yellow:t=8:replace=1',
  '-frames:v',
  '1',
  paint,
]);
const png = `data:image/png;base64,${(await fs.readFile(paint)).toString('base64')}`;
const paintPixel = execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-i',
  paint,
  '-vf',
  'crop=1:1:200:420',
  '-pix_fmt',
  'rgba',
  '-frames:v',
  '1',
  '-f',
  'rawvideo',
  '-',
]);
assert.deepEqual([...paintPixel], [255, 255, 0, 255]);
const output = path.join(root, label);
await fs.mkdir(output); // Never overwrite an earlier measurement.
const app = await electron.launch(
  getElectronLaunchOptions(path.join(output, 'profile')),
);
let diagnostics = '';
app.process().stdout?.on('data', (data) => {
  diagnostics += data.toString();
});
app.process().stderr?.on('data', (data) => {
  diagnostics += data.toString();
});
const run = promisify(execFile);
const results = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(30_000);
  await page.getByText('新しいパッケージを作成', { exact: true }).waitFor();
  // Warm the export path once; report cold-start observations separately from throughput.
  for (const scenario of [
    'warmup',
    'single-text',
    'sparse-text',
    'sparse-paint-text',
  ]) {
    const sparse = scenario.startsWith('sparse');
    const begun = performance.now();
    const logStart = diagnostics.length;
    const result = await page.evaluate(
      async (input) => {
        const { sourcePath, output, scenario, sparse, png } = input;
        return window.electronAPI.exportClipsWithOverlay({
          sourcePath,
          outputDir: output,
          outputFileName: scenario,
          mode: 'single',
          exportMode: 'single',
          angleOption: 'single',
          clips: [2, sparse ? 122 : 14].map((start, index) => ({
            id: `clip-${index}`,
            actionName: 'Review',
            memo: '外側のスペースを確認\nサポートを早く',
            startTime: start,
            endTime: start + 6,
            ...(scenario.includes('paint')
              ? {
                  motionOverlays: [
                    {
                      start: 0,
                      end: 6,
                      baseWidth: 1280,
                      baseHeight: 720,
                      target: 'primary',
                      png,
                      keyframes: [
                        { time: 0, x: 0, y: 0 },
                        { time: 6, x: 120, y: 0 },
                      ],
                    },
                  ],
                }
              : {}),
          })),
          overlay: {
            enabled: true,
            showActionName: true,
            showActionIndex: false,
            showLabels: false,
            showMemo: true,
          },
        });
      },
      {
        sourcePath: sparse ? sources[0] : original,
        output,
        scenario,
        sparse,
        png,
      },
    );
    const seconds = (performance.now() - begun) / 1000;
    assert.equal(result.success, true, result.error);
    if (scenario === 'warmup') {
      console.log(JSON.stringify({ scenario, seconds }));
      continue;
    }
    const file = path.join(output, `${scenario}_angle1.mp4`);
    const metadata = JSON.parse(
      execFileSync(
        ffprobePath,
        ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
        { encoding: 'utf8' },
      ),
    );
    assert.ok(Math.abs(Number(metadata.format.duration) - 12) < 0.1);
    if (scenario.includes('paint')) {
      const pixel = execFileSync(ffmpegPath, [
        '-v',
        'error',
        '-ss',
        '1',
        '-i',
        file,
        '-vf',
        'format=rgb24,crop=1:1:250:422',
        '-frames:v',
        '1',
        '-f',
        'rawvideo',
        '-',
      ]);
      assert.ok(
        pixel[0] > 220 && pixel[1] > 220 && pixel[2] < 40,
        'the moving Paint outline must be visible in the exported image',
      );
    }
    // Compare unchanged upper-half pixels against the decoded original, excluding text/Paint.
    const { stderr } = await run(
      ffmpegPath,
      [
        '-ss',
        '2',
        '-t',
        '6',
        '-i',
        original,
        '-t',
        '6',
        '-i',
        file,
        '-filter_complex',
        '[0:v]setpts=PTS-STARTPTS,crop=iw:ih/2:0:0[ref];[1:v]setpts=PTS-STARTPTS,crop=iw:ih/2:0:0[out];[ref][out]ssim',
        '-an',
        '-f',
        'null',
        '-',
      ],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    const ssim = Number(stderr.match(/All:([\d.]+)/)?.[1]);
    assert.ok(Number.isFinite(ssim));
    const operationLog = diagnostics.slice(logStart);
    const video = metadata.streams.find(
      (stream) => stream.codec_type === 'video',
    );
    results.push({
      scenario,
      seconds,
      ssim,
      width: video.width,
      height: video.height,
      frameRate: video.avg_frame_rate,
      encodeProcesses: (operationLog.match(/operation: 'encode'/g) ?? [])
        .length,
      copyProcesses: (operationLog.match(/operation: 'stream-copy'/g) ?? [])
        .length,
    });
    console.log(JSON.stringify(results.at(-1)));
  }
  await fs.writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(results, null, 2),
  );
} finally {
  await app.close();
}
