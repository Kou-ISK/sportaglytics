import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { getTimelineWindow } from './e2e-angle-sync-workspace.mjs';

// Run on the real startup window. Only native choices and one filesystem failure
// are injected; selection, conversion, playback, edits and binding use the app.
export const exerciseNamedLegacyOpen = async (
  main,
  app,
  root,
  fixtureVideo,
) => {
  const source = path.join(root, 'Pre-suffix practice');
  const destination = source + '.stpkg';
  const relative = 'videos/Pre-suffix practice Near.mp4';
  await fs.mkdir(path.join(source, 'videos'), { recursive: true });
  await fs.mkdir(path.join(source, '.metadata'));
  const bytes = await fs.readFile(fixtureVideo);
  await fs.copyFile(fixtureVideo, path.join(source, relative));
  const config = JSON.stringify({
    tightViewPath: relative,
    wideViewPath: null,
    primaryAngleId: 'near',
    angles: [
      { id: 'near', name: 'Near', role: 'primary', relativePath: relative },
    ],
  });
  const tags = JSON.stringify([
    {
      id: 'legacy-scene',
      actionName: 'Review',
      startTime: 1.125,
      endTime: 2.875,
      memo: 'Original',
    },
  ]);
  await fs.writeFile(path.join(source, '.metadata/config.json'), config);
  await fs.writeFile(path.join(source, 'timeline.json'), tags);
  await app.evaluate(({ dialog }, original) => {
    const fsp = process.getBuiltinModule('fs/promises');
    const rename = fsp.rename.bind(fsp);
    fsp.rename = async (from, to) => {
      if (from === original) {
        fsp.rename = rename;
        throw new Error('Synthetic failure at original archival');
      }
      return rename(from, to);
    };
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [original],
    });
    dialog.showMessageBox = async (...args) => {
      const buttons = args.at(-1).buttons;
      const response = buttons.includes('.stpkg に変更')
        ? buttons.indexOf('.stpkg に変更')
        : buttons.indexOf('この場所の内容を使う');
      if (response < 0) throw new Error('Unexpected conversion confirmation');
      return { response, checkboxChecked: false };
    };
  }, source);
  const open = main.getByRole('button', {
    name: 'パッケージを開く',
    exact: true,
  });
  await open.click();
  await main
    .getByText('変換を完了できませんでした。', { exact: false })
    .first()
    .waitFor();
  assert.equal(
    await fs.readFile(path.join(source, '.metadata/config.json'), 'utf8'),
    config,
  );
  assert.equal(
    await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
    tags,
  );
  assert.deepEqual(await fs.readFile(path.join(source, relative)), bytes);
  // Keep the partial output until the end of this disposable fixture.
  await fs.rename(destination, path.join(root, 'Retained interrupted output'));
  await open.click();
  await main.waitForFunction(
    () => document.querySelector('#video_0 video')?.readyState >= 2,
  );
  const tl = await getTimelineWindow(app);
  await tl.getByRole('slider', { name: 'タイムラインの再生位置' }).waitFor();
  await tl.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({
      type: 'update-memo',
      id: 'legacy-scene',
      memo: 'Saved after conversion',
    }),
  );
  const timeline = path.join(destination, 'timeline.json');
  for (let i = 0; i < 100; i++) {
    const doc = JSON.parse(await fs.readFile(timeline, 'utf8'));
    if (doc.instances[0].memo === 'Saved after conversion') {
      assert.equal(doc.instances[0].startTime, 1.125);
      assert.equal(doc.instances[0].endTime, 2.875);
      break;
    }
    if (i === 99)
      assert.fail('The actual timeline edit did not reach the .stpkg');
    await delay(50);
  }
  const installed = JSON.parse(
    await fs.readFile(path.join(destination, '.metadata/config.json'), 'utf8'),
  );
  assert.deepEqual(
    await fs.readFile(
      path.join(destination, installed.angles[0].clips[0].relativePath),
    ),
    bytes,
  );
  return destination;
};
