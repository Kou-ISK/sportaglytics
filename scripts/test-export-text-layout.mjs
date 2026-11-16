import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { compileBenchmarkModules } from './compile-benchmark-modules.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';

// Uses the production layout, real font metrics and export filters. No private media.
const graph = await compileBenchmarkModules({
  entrypoints: { text: 'scripts/testing/export-text-modules.ts' },
});
const destination = process.env.EXPORT_TEXT_EVIDENCE_DIR
  ? path.resolve(process.env.EXPORT_TEXT_EVIDENCE_DIR)
  : path.join(graph.temporaryDirectory, 'evidence');
await fs.mkdir(destination, { recursive: true });
const run = async (args, binary = false) =>
  (
    await promisify(execFile)(ffmpegPath, args, {
      encoding: binary ? 'buffer' : 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      timeout: 30000,
    })
  ).stdout;
const { getJapaneseFontPath, escapeDrawtext } = graph.modules.text;
const measure = graph.modules.text.createClipTextMeasurer(
  () => ffmpegPath,
  getJapaneseFontPath,
);
const results = [];
try {
  const cases = [
    ['punctuation', 1920, 1080, "100% player's note: [wide], \\path; next"],
    ['whitespace', 1920, 1080, '   Support 前へ   '],
    ['japanese-fit', 1920, 1080, '前'.repeat(60)],
    ['japanese-wrap', 1920, 1080, '前'.repeat(120)],
    ['english-fit', 1920, 1080, 'iiii '.repeat(25)],
    [
      'english-wrap',
      1280,
      720,
      'Support the player and move into space. '.repeat(6),
    ],
    ['mixed', 3840, 2160, '位置 Position 10: 前へ、外へ。 '.repeat(8)],
    ['explicit-lines', 1920, 1080, '前へ\r\n\r\nMove wide\nか\u3099を確認'],
    ['portrait', 1080, 1920, '前へ支援する Support '.repeat(6)],
    ['four-three', 1440, 1080, '前'.repeat(80)],
    ['dual', 3840, 1080, '前'.repeat(120)],
    ['small', 640, 360, '前'.repeat(60)],
    ['long-token', 1920, 1080, 'W'.repeat(160)],
    ['bold', 1920, 1080, 'Title 支援の位置 '.repeat(12), true],
  ];
  for (const [name, width, height, text, isBold = false] of cases) {
    const started = performance.now();
    const layout = await graph.modules.text.layoutClipExportText(
      [{ text, isBold }],
      { width, height },
      measure,
    );
    assert.equal(layout.overflow, false, name);
    assert.equal(
      layout.lines.map((line) => line.text).join(''),
      text.replace(/[\r\n]/g, ''),
      name,
    );
    if (['japanese-fit', 'english-fit', 'dual', 'small'].includes(name))
      assert.equal(layout.lines.length, 1, name);
    if (name === 'japanese-wrap')
      assert.deepEqual(
        layout.lines.map((line) => line.text.length),
        [62, 58],
      );
    if (name === 'explicit-lines')
      assert.deepEqual(
        layout.lines.map((line) => line.text),
        ['前へ', '', 'Move wide', 'か\u3099を確認'],
      );
    const filters = graph.modules.text.buildOverlayFilters({
      layout,
      height,
      getJapaneseFontPath,
      escapeDrawtext,
    });
    // An independent textfile render must match the escaped inline text exactly.
    // This catches percent expansion, quotes, slashes and stripped indentation.
    const referenceFilters = [filters[0]];
    for (const [index, line] of layout.lines.entries()) {
      const file = path.join(graph.temporaryDirectory, `row-${index}.txt`);
      await fs.writeFile(file, line.text);
      referenceFilters.push(
        filters[index + 1].replace(
          /:text=.*:expansion=none/,
          `:textfile=${graph.modules.text.escapeFilterOption(file.replace(/\\/g, '/'))}:expansion=none`,
        ),
      );
    }
    const renderRaw = (filter) =>
      run(
        [
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          `color=c=blue:s=${width}x${height}:d=0.04`,
          '-vf',
          filter.join(','),
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
    assert.deepEqual(
      await renderRaw(filters),
      await renderRaw(referenceFilters),
      `${name}: rendered text differs from literal textfile`,
    );
    const output = path.join(destination, `${name}.mp4`);
    await run([
      '-v',
      'error',
      '-nostdin',
      '-f',
      'lavfi',
      '-i',
      `color=c=blue:s=${width}x${height}:r=25:d=0.12`,
      '-vf',
      filters.join(','),
      '-c:v',
      fixtureH264Encoder,
      '-pix_fmt',
      'yuv420p',
      '-y',
      output,
    ]);
    const pixels = await run(
      [
        '-v',
        'error',
        '-i',
        output,
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
    let minX = width,
      maxX = -1,
      minY = height,
      maxY = -1,
      count = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3;
        if (
          pixels[offset] > 180 &&
          pixels[offset + 1] > 180 &&
          pixels[offset + 2] > 180
        ) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          count++;
        }
      }
    assert.ok(count > 0, `${name}: no text pixels`);
    assert.ok(minX >= Math.floor(width * 0.015) - 1, `${name}: left clipping`);
    assert.ok(maxX < width * 0.985, `${name}: right clipping`);
    assert.ok(
      minY >= height * 0.8 && maxY < height - 1,
      `${name}: vertical clipping`,
    );
    if (name === 'japanese-fit')
      assert.ok(maxX > width * 0.94, 'unused horizontal area');
    await run([
      '-v',
      'error',
      '-i',
      output,
      '-frames:v',
      '1',
      '-y',
      path.join(destination, `${name}.png`),
    ]);
    results.push({
      name,
      width,
      height,
      rows: layout.lines.length,
      fontSize: Math.round(height * layout.fontRatio),
      bounds: { minX, maxX, minY, maxY },
      elapsedMs: Math.round(performance.now() - started),
    });
  }
  const overflow = await graph.modules.text.layoutClipExportText(
    [{ text: 'line\n'.repeat(15), isBold: false }],
    { width: 1920, height: 1080 },
    measure,
  );
  assert.equal(overflow.overflow, true);
  assert.throws(
    () =>
      graph.modules.text.buildOverlayFilters({
        layout: overflow,
        height: 1080,
        getJapaneseFontPath,
        escapeDrawtext,
      }),
    /20%/,
  );
  const report = {
    platform: process.platform,
    ffmpeg: (await run(['-version'])).split('\n')[0],
    results,
    overflowRejected: true,
  };
  await fs.writeFile(
    path.join(destination, 'results.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await graph.dispose();
}
