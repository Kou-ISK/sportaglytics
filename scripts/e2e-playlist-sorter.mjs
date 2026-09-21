import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

/** Runs against the same real Electron/export setup as e2e-export-menu. */
export async function exercisePlaylistSorter({
  app,
  main,
  dir,
  output,
  clickExportMenu,
}) {
  const folder = path.join(dir, 'sorter.stpl');
  await fs.mkdir(folder);
  const definitions = [
    { id: 'a', color: 'blue', duration: 9, rowId: 'phase', rowOrder: 0 },
    { id: 'b', color: 'red', duration: 3, rowId: 'other', rowOrder: 0 },
    { id: 'c', color: 'green', duration: 6, rowId: 'phase', rowOrder: 1 },
  ];
  for (const clip of definitions) {
    execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=${clip.color}:s=320x180:r=25:d=10`,
      '-c:v',
      fixtureH264Encoder,
      '-pix_fmt',
      'yuv420p',
      path.join(dir, `${clip.id}.mp4`),
    ]);
  }
  await fs.writeFile(
    path.join(folder, 'playlist.json'),
    JSON.stringify({
      schemaVersion: 2,
      id: 'sorter',
      name: 'Sorter review',
      type: 'reference',
      createdAt: 1,
      updatedAt: 1,
      rows: [
        { id: 'phase', name: 'Phase', order: 0, enabled: true },
        { id: 'other', name: 'Other', order: 1, enabled: true },
      ],
      items: definitions.map((clip) => ({
        id: clip.id,
        timelineItemId: clip.id,
        actionName: clip.color,
        startTime: 0,
        endTime: clip.duration,
        addedAt: 1,
        rowId: clip.rowId,
        rowOrder: clip.rowOrder,
        videoSource: path.join(dir, `${clip.id}.mp4`),
      })),
    }),
  );
  const open = async () => {
    const pending = app.waitForEvent('window');
    await main.evaluate(
      (file) => window.electronAPI.playlist.loadPlaylistFile(file),
      folder,
    );
    const page = await pending;
    await page.getByRole('button', { name: 'Sorter', exact: true }).click();
    await page.getByTestId('sorter-row-a').waitFor();
    return page;
  };
  let page = await open();
  const assertOrder = async (ids) =>
    page.waitForFunction((expected) => {
      const actual = [
        ...document.querySelectorAll('[data-testid^="sorter-row-"]'),
      ].map((row) =>
        row.getAttribute('data-testid').replace('sorter-row-', ''),
      );
      return JSON.stringify(actual) === JSON.stringify(expected);
    }, ids);
  const assertCurrent = async (id) =>
    page
      .locator(`[data-testid="sorter-row-${id}"][aria-current="true"]`)
      .waitFor();
  await assertOrder(['a', 'c', 'b']);
  await page.getByTestId('sorter-row-a').click();
  await page.getByRole('button', { name: '長さを昇順に並べ替え' }).click();
  await assertOrder(['b', 'c', 'a']);
  await assertCurrent('a');
  await page.keyboard.press(`${primaryModifier}+z`);
  await assertOrder(['a', 'c', 'b']);
  await assertCurrent('a');
  await page.keyboard.press(`${primaryModifier}+Shift+z`);
  await assertOrder(['b', 'c', 'a']);
  await assertCurrent('a');
  // Actual playback navigation must use the same order as the table.
  await page.getByTestId('sorter-row-b').dblclick();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('video')].some((video) =>
      video.currentSrc.endsWith('/b.mp4'),
    ),
  );
  await page.getByTestId('sorter-row-b').click();
  await page.keyboard.press(`${primaryModifier}+Alt+ArrowRight`);
  await assertCurrent('c');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('video')].some((video) =>
      video.currentSrc.endsWith('/c.mp4'),
    ),
  );
  await page.getByTestId('sorter-row-c').click();
  await page.keyboard.press(`${primaryModifier}+s`);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const saved = JSON.parse(
      await fs.readFile(path.join(folder, 'playlist.json'), 'utf8'),
    );
    if (saved.schemaVersion === 3) break;
    await delay(100);
  }
  const saved = JSON.parse(
    await fs.readFile(path.join(folder, 'playlist.json'), 'utf8'),
  );
  assert.equal(saved.schemaVersion, 3);
  assert.deepEqual(
    [...saved.items]
      .sort((a, b) => a.presentationOrder - b.presentationOrder)
      .map((item) => item.id),
    ['b', 'c', 'a'],
  );
  assert.equal(saved.items.find((item) => item.id === 'b').rowId, 'other');
  const closed = page.waitForEvent('close');
  await (await app.browserWindow(page)).evaluate((window) => window.close());
  await closed;
  page = await open();
  await assertOrder(['b', 'c', 'a']);
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.E2E_SCREENSHOT_DIR, 'playlist-sorter.png'),
    });
  }
  for (const candidate of app.windows()) {
    if (candidate.url().includes('export-progress')) {
      const closedProgress = candidate.waitForEvent('close');
      await (
        await app.browserWindow(candidate)
      ).evaluate((window) => window.close());
      await closedProgress;
    }
  }
  await clickExportMenu(page);
  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: 'プレイリストを書き出し' });
  await dialog.getByLabel('ファイル名 (拡張子不要)').fill('sorter-order');
  await dialog.getByRole('button', { name: '非表示', exact: true }).click();
  const pending = app.waitForEvent('window');
  await dialog.getByRole('button', { name: '書き出す', exact: true }).click();
  const progress = await pending;
  await progress
    .getByText('書き出し完了', { exact: true })
    .waitFor({ timeout: 60000 });
  const file = (await fs.readdir(output)).find(
    (name) => name.startsWith('sorter-order') && name.endsWith('.mp4'),
  );
  assert.ok(file);
  // Decode samples of the resulting file: red -> green -> blue, independent of filenames/metadata.
  for (const [time, channel] of [
    [1, 0],
    [5, 1],
    [12, 2],
  ]) {
    const rgb = execFileSync(ffmpegPath, [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      path.join(output, file),
      '-frames:v',
      '1',
      '-vf',
      'scale=1:1',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      'pipe:1',
    ]);
    assert.equal(rgb.length, 3);
    assert.ok(
      rgb[channel] > 70 &&
        rgb[channel] > rgb[(channel + 1) % 3] + 50 &&
        rgb[channel] > rgb[(channel + 2) % 3] + 50,
      `Export frame ${time} must match presentation order`,
    );
  }
  console.log(
    'Sorter UI -> playback -> Undo/Redo -> save/reopen -> FFmpeg frame order passed',
  );
}
