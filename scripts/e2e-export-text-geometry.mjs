import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), 'export-text-geometry-'),
);
const run = async (tool, args, binary = false) =>
  (
    await promisify(execFile)(tool, args, {
      encoding: binary ? 'buffer' : 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 30000,
    })
  ).stdout;
let app;
try {
  for (const [name, width, height, sar] of [
    ['wide', 960, 540, '1/1'],
    ['sar', 720, 576, '16/15'],
  ])
    await run(ffmpegPath, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=blue:s=${width}x${height}:r=25:d=0.4`,
      '-vf',
      `setsar=${sar}`,
      '-c:v',
      fixtureH264Encoder,
      '-pix_fmt',
      'yuv420p',
      path.join(directory, `${name}.mp4`),
    ]);
  await run(ffmpegPath, [
    '-v',
    'error',
    '-display_rotation:v:0',
    '90',
    '-i',
    path.join(directory, 'wide.mp4'),
    '-c',
    'copy',
    path.join(directory, 'rotated.mp4'),
  ]);
  app = await electron.launch(
    getElectronLaunchOptions(path.join(directory, 'profile')),
  );
  const results = [];
  for (const [name, source, secondary, width, height] of [
    ['single', 'wide', null, 960, 540],
    ['rotated', 'rotated', null, 540, 960],
    ['dual-sar', 'sar', 'wide', 1792, 576],
  ]) {
    const output = path.join(directory, `${name}-output.mp4`);
    const result = await app.evaluate(
      async ({ app }, args) => {
        const require = process
          .getBuiltinModule('module')
          .createRequire(`${app.getAppPath()}/package.json`);
        const {
          createExportTextPreview,
        } = require('./build/electron/src/ipc/exportTextPreview.js');
        const {
          runFfmpegSingle,
          runFfmpegDual,
        } = require('./build/electron/src/ipc/exportFfmpegRunners.js');
        const {
          getJapaneseFontPath,
          escapeDrawtext,
        } = require('./build/electron/src/ipc/exportOptions.js');
        const clip = {
          id: 'synthetic',
          actionName: 'Fixture',
          startTime: 0,
          endTime: 0.4,
          memo: '前'.repeat(60),
        };
        const payload = {
          sourcePath: args.source,
          sourcePath2: args.secondary,
          mode: args.secondary ? 'dual' : 'single',
          clips: [clip],
          overlay: {
            enabled: true,
            showActionIndex: false,
            showActionName: false,
            showLabels: false,
            showMemo: true,
          },
        };
        const preview = await createExportTextPreview(
          { exports: [payload], previewIndex: 0 },
          () => args.ffmpeg,
        );
        const common = {
          getFfmpegPath: () => args.ffmpeg,
          clip: { ...clip, hasAudio: false },
          outputPath: args.output,
          overlayEnabled: true,
          overlayLines: [{ text: clip.memo, isBold: false }],
          getJapaneseFontPath,
          escapeDrawtext,
        };
        if (args.secondary)
          await runFfmpegDual({
            ...common,
            mainSource: args.source,
            secondarySource: args.secondary,
          });
        else await runFfmpegSingle({ ...common, sourcePath: args.source });
        return preview;
      },
      {
        source: path.join(directory, `${source}.mp4`),
        secondary: secondary
          ? path.join(directory, `${secondary}.mp4`)
          : undefined,
        output,
        ffmpeg: ffmpegPath,
      },
    );
    const metadata = JSON.parse(
      await run(ffprobePath, [
        '-v',
        'error',
        '-show_streams',
        '-of',
        'json',
        output,
      ]),
    );
    const stream = metadata.streams.find(
      (stream) => stream.codec_type === 'video',
    );
    assert.deepEqual([stream.width, stream.height], [width, height], name);
    assert.deepEqual(
      [result.clips[0].width, result.clips[0].height],
      [width, height],
      `${name} preview geometry`,
    );
    const preview = path.join(directory, `${name}-preview.png`);
    await fs.writeFile(
      preview,
      Buffer.from(result.image.split(',')[1], 'base64'),
    );
    const decode = (file, scaled) =>
      run(
        ffmpegPath,
        [
          '-v',
          'error',
          '-i',
          file,
          ...(scaled ? ['-vf', "scale=w='min(960,iw)':h=-2"] : []),
          '-frames:v',
          '1',
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          '-',
        ],
        true,
      );
    const rendered = await decode(output, true);
    const previewPixels = await decode(preview, false);
    assert.equal(rendered.length, previewPixels.length, name);
    let difference = 0;
    for (let index = 0; index < rendered.length; index++)
      difference += Math.abs(rendered[index] - previewPixels[index]);
    const meanAbsoluteError = difference / rendered.length;
    assert.ok(
      meanAbsoluteError < 3,
      `${name}: preview/output diverged (${meanAbsoluteError})`,
    );
    assert.equal(result.clips[0].layout.overflow, false);
    results.push({
      name,
      width,
      height,
      lines: result.clips[0].layout.lines.length,
      meanAbsoluteError,
    });
  }
  console.log(JSON.stringify({ realMainPreviewAndExport: results }, null, 2));
} finally {
  await app?.close();
  await fs.rm(directory, { recursive: true, force: true });
}
