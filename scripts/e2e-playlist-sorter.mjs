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
      `color=c=${clip.color}:s=1280x720:r=25:d=10`,
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
        ...(clip.id === 'b'
          ? { memo: 'Source note', note: 'Existing note' }
          : {}),
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
  const note = '外側のスペースを確認\nサポートを早く\n前を向く';
  const noteCell = page.getByTestId('sorter-row-b').getByRole('cell').nth(5);
  assert.match(await noteCell.innerText(), /Existing note/);
  assert.match(await noteCell.innerText(), /Source note/);
  await noteCell.dblclick();
  const editor = page.getByTestId('sorter-row-b').getByRole('textbox');
  await editor.fill(note);
  await editor.press('Control+Tab');
  await page.getByTestId('sorter-row-c').getByRole('textbox').waitFor();
  await page.getByTestId('sorter-row-c').getByRole('textbox').press('Escape');
  assert.equal(
    await page
      .getByTestId('playlist-sorter')
      .getByRole('textbox', { name: 'クリップのノート' })
      .count(),
    0,
  );
  await page.getByTestId('sorter-row-b').click();
  await page.keyboard.press(`${primaryModifier}+s`);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const saved = JSON.parse(
      await fs.readFile(path.join(folder, 'playlist.json'), 'utf8'),
    );
    if (saved.schemaVersion === 4) break;
    await delay(100);
  }
  const saved = JSON.parse(
    await fs.readFile(path.join(folder, 'playlist.json'), 'utf8'),
  );
  assert.equal(saved.schemaVersion, 4);
  assert.equal(saved.items.find((item) => item.id === 'b').note, note);
  assert.ok(saved.items.every((item) => !('memo' in item)));
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
  assert.equal(
    await page
      .getByTestId('sorter-row-b')
      .getByRole('cell')
      .nth(5)
      .textContent(),
    note,
  );
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
  assert.equal(
    await dialog
      .getByRole('button', { name: '書き出す', exact: true })
      .isDisabled(),
    true,
  );
  await dialog.getByLabel('ファイル名 (拡張子不要)').fill('sorter-order');
  await dialog.getByRole('radio', { name: '含めない', exact: true }).check();
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
  await (
    await app.browserWindow(progress)
  ).evaluate((window) => window.close());
  await page.getByTestId('sorter-row-b').click();
  await clickExportMenu(page);
  assert.equal(
    await dialog
      .getByRole('button', { name: '書き出す', exact: true })
      .isDisabled(),
    true,
    'each export must confirm text inclusion again',
  );
  await dialog.getByRole('radio', { name: /選択中のアイテム/ }).check();
  await dialog.getByRole('radio', { name: '含める', exact: true }).check();
  assert.ok((await dialog.innerText()).includes(note));
  for (const name of ['アクション名', '通番', 'ラベル']) {
    await dialog.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  await dialog.getByLabel('ファイル名 (拡張子不要)').fill('sorter-notes');
  await dialog
    .getByRole('img', { name: '書き出し映像のテキスト配置' })
    .waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector('[role=dialog] button.MuiButton-contained')
        ?.disabled,
  );
  if (process.env.E2E_SCREENSHOT_DIR) {
    await dialog
      .getByRole('img', { name: '書き出し映像のテキスト配置' })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'playlist-note-export.png',
      ),
    });
  }
  const pendingNotes = app.waitForEvent('window');
  await dialog.getByRole('button', { name: '書き出す', exact: true }).click();
  const notesProgress = await pendingNotes;
  await notesProgress
    .getByText('書き出し完了', { exact: true })
    .waitFor({ timeout: 60000 });
  const notesFile = (await fs.readdir(output)).find(
    (name) => name.startsWith('sorter-notes') && name.endsWith('.mp4'),
  );
  assert.ok(notesFile);
  const pixels = execFileSync(
    ffmpegPath,
    [
      '-v',
      'error',
      '-ss',
      '1',
      '-i',
      path.join(output, notesFile),
      '-frames:v',
      '1',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      'pipe:1',
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  assert.equal(pixels.length, 1280 * 720 * 3);
  // Each of the three Japanese note lines must be visible inside the actual output frame.
  for (const [start, end] of [
    [637, 662],
    [662, 687],
    [687, 714],
  ]) {
    let white = 0;
    for (let y = start; y < end; y++)
      for (let x = 2; x < 1000; x++) {
        const i = (y * 1280 + x) * 3;
        if (pixels[i] > 150 && pixels[i + 1] > 150 && pixels[i + 2] > 150)
          white++;
      }
    assert.ok(white > 5, 'each note line must appear in the exported video');
  }
  console.log(
    'Playlist notes -> inline Control+Tab -> save/reopen -> per-export choice -> Japanese multiline FFmpeg output passed',
  );
  await (
    await app.browserWindow(notesProgress)
  ).evaluate((window) => window.close());
  await page.getByTestId('sorter-row-b').getByRole('cell').nth(5).dblclick();
  const longEditor = page.getByTestId('sorter-row-b').getByRole('textbox');
  await longEditor.fill('長文の確認\n'.repeat(9));
  await longEditor.press('Enter');
  await clickExportMenu(page);
  await dialog.getByRole('radio', { name: '含める', exact: true }).check();
  await dialog.getByText(/テキストが映像の高さ20%に収まりません/).waitFor();
  assert.equal(
    await dialog
      .getByRole('button', { name: '書き出す', exact: true })
      .isDisabled(),
    true,
  );
  const directResult = await page.evaluate(
    async (source) =>
      window.electronAPI.exportClipsWithOverlay({
        sourcePath: source,
        clips: [
          {
            id: 'too-long',
            actionName: 'Fixture',
            startTime: 0,
            endTime: 1,
            memo: 'line\n'.repeat(9),
          },
        ],
        overlay: {
          enabled: true,
          showActionName: true,
          showActionIndex: true,
          showLabels: true,
          showMemo: true,
        },
      }),
    path.join(dir, 'b.mp4'),
  );
  assert.equal(directResult.success, false);
  assert.match(directResult.error, /20%/);
  await dialog.getByRole('checkbox', { name: 'ノート', exact: true }).uncheck();
  await page.waitForFunction(
    () =>
      !document.querySelector('[role=dialog] button.MuiButton-contained')
        ?.disabled,
  );
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  console.log(
    'Preview, overflow blocking, main-process guard and recovery passed',
  );
}
