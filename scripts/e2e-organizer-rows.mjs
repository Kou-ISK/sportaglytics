import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const colorAt = (file, seconds) => {
  const rgb = execFileSync(ffmpegPath, ['-v', 'error', '-ss', String(seconds),
    '-i', file, '-frames:v', '1', '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']);
  assert.equal(rgb.length, 3);
  return ['red', 'green', 'blue'][rgb.indexOf(Math.max(...rgb))];
};

export async function exerciseOrganizerRows({ app, main, dir, output, clickExportMenu }) {
  const folder = path.join(dir, 'meeting.stpl');
  await fs.mkdir(folder);
  const file = path.join(folder, 'playlist.json');
  const items = [
    ['A1', 'A', 'One', 'b'], ['B1', 'B', 'One', 'c'], ['A2', 'A', 'Two', 'a'],
  ].map(([id, rowId, actionName, source], presentationOrder) => ({
    id, rowId, actionName, presentationOrder, timelineItemId: null,
    startTime: 0, endTime: 2, addedAt: 1, videoSource: path.join(dir, source + '.mp4'),
  }));
  await fs.writeFile(file, JSON.stringify({
    id: 'meeting', name: 'Meeting', type: 'reference', createdAt: 1, updatedAt: 1,
    rows: ['A', 'B'].map((id, order) => ({ id, name: 'Theme', enabled: id === 'A', order })),
    items,
  }));
  const open = async () => {
    const pending = app.waitForEvent('window');
    await main.evaluate((p) => window.electronAPI.playlist.loadPlaylistFile(p), folder);
    const page = await pending;
    await page.getByRole('button', { name: 'Organizer', exact: true }).click();
    await page.getByTestId('organizer-clip-A1').waitFor();
    return page;
  };
  const close = async (page) => {
    const pending = page.waitForEvent('close');
    await (await app.browserWindow(page)).evaluate((window) => window.close());
    await pending;
  };
  let page = await open();
  const row = (id) => page.getByTestId('organizer-row-' + id);
  const item = (id) => page.getByTestId('organizer-clip-' + id);
  const command = async (id, name) => {
    await row(id).getByRole('button', { name: /の行操作/ }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  };
  await command('A', 'この行を再生');
  for (const source of ['b.mp4', 'a.mp4']) {
    await page.waitForFunction((name) => [...document.querySelectorAll('video')].some(
      (video) => video.currentSrc.endsWith('/' + name) && !video.paused && video.currentTime > 0.1,
    ), source, { timeout: 12000 });
  }
  await item('A1').dragTo(row('B'));
  await row('B').getByTestId('organizer-clip-A1').waitFor();
  await item('A1').dragTo(row('B'));
  await page.keyboard.press(primaryModifier + '+z');
  await row('A').getByTestId('organizer-clip-A1').waitFor();
  await command('B', '行を上へ');
  await page.keyboard.press(primaryModifier + '+s');
  await page.waitForFunction(() => !document.title.includes('*'));
  await close(page);
  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.deepEqual(saved.rows.map((r) => r.id), ['B', 'A']);
  assert.deepEqual(saved.items.sort((a,b) => a.presentationOrder-b.presentationOrder).map((i) => i.id), ['A1','B1','A2']);
  page = await open();
  for (const [mode, prefix, expected] of [
    ['Organizer の行ごと', 'by-theme', ['red,blue', 'green']],
    ['アクションごと', 'by-action', ['red,green', 'blue']],
  ]) {
    await clickExportMenu(page);
    const dialog = page.getByRole('dialog').filter({hasText:'プレイリストを書き出し'});
    await dialog.getByRole('button', { name: mode, exact: true }).click();
    if (prefix === 'by-theme') {
      await dialog.getByText(/出力 2 本/).waitFor();
      await dialog.getByText('Theme · 2 件').waitFor();
      await dialog.getByText('Theme · 1 件').waitFor();
    }
    await dialog.getByLabel('ファイル名 (拡張子不要)').fill(prefix);
    await dialog.getByRole('radio', { name: '含めない', exact: true }).check();
    const pending = app.waitForEvent('window');
    await dialog.getByRole('button', { name:'書き出す', exact:true }).click();
    const progress = await pending;
    await progress.getByText('書き出し完了', {exact:true}).waitFor({timeout:60000});
    const files = (await fs.readdir(output)).filter((f) => f.startsWith(prefix) && f.endsWith('.mp4'));
    assert.equal(files.length, 2);
    const samples = files.map((f) => {
      const source = path.join(output, f);
      const first = colorAt(source, 1);
      return first === 'red' ? first + ',' + colorAt(source, 3) : first;
    });
    assert.deepEqual(samples.sort(), expected.sort());
    await close(progress);
  }
  await close(page);
  console.log('Organizer membership, row playback, no-op drop, Undo, save/reopen, row and action MP4 frame order passed');
}
