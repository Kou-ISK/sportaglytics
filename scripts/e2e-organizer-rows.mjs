import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath, ffprobePath } from './media-tool-paths.mjs';

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
  const red = path.join(dir, 'meeting-red.mp4');
  const blue = path.join(dir, 'meeting-blue.mp4');
  for (const [source, frequency, destination] of [['b.mp4',440,red], ['a.mp4',880,blue]]) {
    execFileSync(ffmpegPath, ['-v','error','-i',path.join(dir,source),'-f','lavfi','-i',
      'sine=frequency=' + frequency + ':sample_rate=48000','-t','3','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac',destination]);
  }
  const items = [
    ['A1', 'A', 'One', 'b'], ['B1', 'B', 'One', 'c'], ['A2', 'A', 'Two', 'a'],
  ].map(([id, rowId, actionName, source], presentationOrder) => ({
    id, rowId, actionName, presentationOrder, timelineItemId: null,
    startTime: 0, endTime: 2, addedAt: 1, videoSource: id === 'B1' ? path.join(dir, source + '.mp4') : red,
    ...(id === 'A2' ? { videoSource2: blue, defaultAngle: 'angle2' } : {}),
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
  const waitForSave = async (matches) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const document = JSON.parse(await fs.readFile(file, 'utf8'));
      if (matches(document) && await app.evaluate(({ app: application }, folder) => {
        const require = process.getBuiltinModule('module').createRequire(application.getAppPath() + '/package.json');
        const { getPlaylistWindows } = require('./build/electron/src/playlistWindow/state.js');
        return [...getPlaylistWindows().values()].some((entry) =>
          entry.filePath === folder && !entry.window.isDestroyed() && !entry.isDirty);
      }, folder)) return document;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Saved Organizer document and Main acknowledgement did not agree');
  };
  let page = await open();
  const row = (id) => page.getByTestId('organizer-row-' + id);
  const item = (id) => page.getByTestId('organizer-clip-' + id);
  const command = async (id, name) => {
    await row(id).getByRole('button', { name: /の行操作/ }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  };
  await command('A', 'この行を再生');
  for (const source of ['meeting-red.mp4', 'meeting-blue.mp4']) {
    await page.waitForFunction((name) => [...document.querySelectorAll('video')].some(
      (video) => video.currentSrc.endsWith('/' + name) && !video.paused && video.currentTime > 0.1,
    ), source, { timeout: 12000 });
  }
  await item('B1').dblclick();
  await page.locator('video:visible').first().hover();
  await page.getByRole('button',{name:'ループ: OFF',exact:true}).click();
  await command('B', 'この行を再生');
  const wraps = await page.evaluate(async () => {
    let previous = 0, count = 0, maximum = 0;
    const deadline = performance.now() + 7500;
    while (performance.now() < deadline && count < 2) {
      await new Promise(requestAnimationFrame);
      const video = [...document.querySelectorAll('video')].find((v) => v.currentSrc.endsWith('/c.mp4'));
      if (!video) continue;
      const time = video.currentTime;
      if (previous > 1.5 && time < .4) count++;
      previous = time;
      maximum = Math.max(maximum,time);
    }
    return {count,maximum};
  });
  assert.equal(wraps.count,2);
  assert.ok(wraps.maximum < 2.25, 'one-item row must stay within its two-second cut');
  await page.locator('video:visible').first().hover();
  await page.getByRole('button',{name:'ループ: ON',exact:true}).click();
  await item('A1').dragTo(row('B'));
  await row('B').getByTestId('organizer-clip-A1').waitFor();
  await item('A1').dragTo(row('B'));
  await page.keyboard.press(primaryModifier + '+z');
  await row('A').getByTestId('organizer-clip-A1').waitFor();
  await command('B', '行を上へ');
  await page.keyboard.press(primaryModifier + '+s');
  await waitForSave((saved) => saved.rows[0]?.id === 'B');
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
  await item('A1').click();
  await command('A', '選択項目の後にスライドを追加');
  let editor = page.getByRole('dialog', { name: 'One の直後に挿入' });
  await editor.getByLabel('タイトル').fill('Meeting question');
  await editor.getByLabel('本文').fill('Which channel is open?');
  await editor.getByLabel('表示秒数').fill('2');
  const image = execFileSync(ffmpegPath, ['-v','error','-f','lavfi','-i','color=c=lime:s=64x64',
    '-frames:v','1','-c:v','png','-f','image2pipe','pipe:1']);
  await editor.locator('input[type=file]').setInputFiles({name:'diagram.png',mimeType:'image/png',buffer:image});
  await editor.getByAltText('スライドの画像').waitFor();
  await editor.getByRole('button', { name:'確定' }).click();
  const card = row('A').getByRole('button').filter({hasText:'Meeting question'});
  await item('A1').dblclick();
  await page.locator('video:visible').first().hover();
  await page.getByRole('button',{name:'ミュート',exact:true}).click();
  await card.dblclick();
  await page.getByRole('img', {name:'Meeting question',exact:true}).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some(
    (v) => v.currentSrc.endsWith('/c.mp4') && !v.paused && v.currentTime > .1 && v.volume === 0), undefined, {timeout:12000});
  await page.keyboard.press(primaryModifier + '+s');
  const stored = await waitForSave((saved) => saved.items.some((entry) => entry.slide?.title === 'Meeting question'));
  const savedSlide = stored.items.find((entry) => entry.slide);
  assert.equal(savedSlide.endTime,2);
  assert.match(savedSlide.slide.image,/^data:image\/png;base64,/);
  assert.equal(savedSlide.videoSource,undefined);
  await close(page);
  page = await open();
  await item(savedSlide.id).dblclick();
  await page.getByRole('img',{name:'Meeting question'}).waitFor();
  await command('A','この行を MP4 に書き出す');
  const dialog = page.getByRole('dialog').filter({ hasText:'プレイリストを書き出し' });
  await dialog.getByText('Theme · 3 件').waitFor();
  await dialog.getByLabel('ファイル名 (拡張子不要)').fill('meeting-a');
  await dialog.getByRole('radio',{name:'含めない',exact:true}).check();
  const result = app.waitForEvent('window');
  await dialog.getByRole('button',{name:'書き出す',exact:true}).click();
  const progress = await result;
  await progress.getByText('書き出し完了',{exact:true}).waitFor({timeout:90000});
  const matches = (await fs.readdir(output)).filter((name) => name.startsWith('meeting-a') && name.endsWith('.mp4'));
  assert.equal(matches.length,1);
  const movie = path.join(output,matches[0]);
  assert.equal(colorAt(movie,.8),'red');
  assert.equal(colorAt(movie,5),'blue');
  const green = execFileSync(ffmpegPath,['-v','error','-ss','3','-i',movie,'-vf','crop=2:2:950:436,scale=1:1',
    '-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
  assert.equal(green.length,3);
  assert.ok(green[1] > 170 && green[0] < 80 && green[2] < 80,'persisted diagram must appear between both clips');
  const info = JSON.parse(execFileSync(ffprobePath,['-v','error','-show_streams','-show_format','-of','json',movie]));
  assert.ok(Math.abs(Number(info.format.duration)-6)<.25,
    'expected 6 s; movie=' + info.format.duration + ', streams=' + JSON.stringify(info.streams.map(({codec_type,duration}) => ({codec_type,duration}))));
  const dialogue = info.streams.find((stream) => stream.codec_type === 'audio');
  assert.equal(dialogue?.channels, 1, 'the synthetic clip remains mono across a silent slide');
  assert.equal(dialogue?.sample_rate, '48000');
  const samplePeak = (seconds) => {
    const pcm = execFileSync(ffmpegPath,['-v','error','-ss',String(seconds),'-i',movie,'-t','0.2',
      '-map','0:a:0','-ac','1','-ar','8000','-f','s16le','pipe:1']);
    assert.ok(pcm.length > 1600);
    let peak = 0;
    for (let i = 0; i + 1 < pcm.length; i += 2) peak = Math.max(peak,Math.abs(pcm.readInt16LE(i)));
    return peak;
  };
  assert.ok(samplePeak(1) > 500, 'clip audio is present');
  assert.ok(samplePeak(3) < 30, 'slide has no audible signal');
  await close(progress);

  const addRow = async (name) => {
    await page.getByRole('button',{name:'行を追加',exact:true}).click();
    const prompt = page.getByRole('dialog',{name:'行を追加'});
    await prompt.getByLabel('行名').fill(name);
    await prompt.getByRole('button',{name:'確定'}).click();
    return page.getByRole('button',{name:name + ' の行操作'});
  };
  await (await addRow('Unused')).click();
  await page.getByRole('menuitem',{name:'空の行を削除'}).click();
  await page.getByRole('button',{name:'Unused の行操作'}).waitFor({state:'detached'});
  await (await addRow('New theme')).click();
  await page.getByRole('menuitem',{name:'行名を変更'}).click();
  const rename = page.getByRole('dialog',{name:'行名を変更'});
  await rename.getByLabel('行名').fill('Introduction');
  await rename.getByRole('button',{name:'確定'}).click();
  const intro = page.getByRole('button',{name:'Introduction の行操作'});
  await intro.click();
  await page.getByRole('menuitem',{name:'行の先頭にスライドを追加'}).click();
  editor = page.getByRole('dialog',{name:'Introduction に追加（全体の最後）'});
  await editor.getByLabel('タイトル').fill('Opening');
  await editor.getByLabel('表示秒数').fill('1');
  await editor.getByRole('button',{name:'確定'}).click();
  await intro.click();
  assert.equal(await page.getByRole('menuitem',{name:'空の行を削除'}).isDisabled(),true);
  await page.getByRole('menuitem',{name:'この行を MP4 に書き出す'}).click();
  await dialog.getByText('Introduction · 1 件').waitFor();
  await dialog.getByLabel('ファイル名 (拡張子不要)').fill('single-slide');
  await dialog.getByRole('radio',{name:'含めない',exact:true}).check();
  const finalProgress = app.waitForEvent('window');
  await dialog.getByRole('button',{name:'書き出す',exact:true}).click();
  const last = await finalProgress;
  await last.getByText('書き出し完了',{exact:true}).waitFor({timeout:60000});
  const names = (await fs.readdir(output)).filter((name) => name.startsWith('single-slide') && name.endsWith('.mp4'));
  assert.equal(names.length,1);
  const slideMovie = path.join(output,names[0]);
  const seconds = Number(execFileSync(ffprobePath,['-v','error','-show_entries','format=duration','-of','csv=p=0',slideMovie]));
  assert.ok(Math.abs(seconds - 1) < .1);
  assert.equal(colorAt(slideMovie,.5),'blue');
  await close(last);
  await page.keyboard.press(primaryModifier + '+s');
  await waitForSave((saved) => saved.items.some((entry) => entry.slide?.title === 'Opening'));
  await close(page);
  console.log('Organizer membership, row playback, no-op drop, Undo, save/reopen, row and action MP4 frame order passed');
}
