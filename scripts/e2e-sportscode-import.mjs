import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-sportscode-'),
);
const sources = path.join(root, 'originals');
const destination = path.join(root, 'new-projects');
await fs.mkdir(sources);
await fs.mkdir(destination);
const xmlPath = path.join(sources, 'Synthetic #%.xml');
const videoPath = path.join(sources, 'Synthetic #%.mp4');
const baseXml = await fs.readFile(
  'src/features/videoPlayer/components/Setup/SportscodeImport/fixtures/synthetic-edit-list.xml',
  'utf8',
);
const preservedLabels = [
  { group: 'actionType', name: 'same' },
  { group: 'Type', name: 'same' },
  { group: '__proto__', name: 'one' },
  { group: '__proto__', name: 'two' },
  { group: 'constructor', name: 'value' },
  { group: 'toString', name: 'value' },
];
const extraLabels = preservedLabels
  .map(
    ({ group, name }) =>
      `<label><group>${group}</group><text>${name}</text></label>`,
  )
  .join('');
const xml = baseXml.replace('</instance>', `${extraLabels}</instance>`);
await fs.writeFile(xmlPath, xml);
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=blue:s=320x180:r=24:d=20',
  '-threads',
  '2',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  '-y',
  videoPath,
]);
const originalVideo = await fs.readFile(videoPath);
await fs.chmod(xmlPath, 0o444);
await fs.chmod(videoPath, 0o444);
const artifacts =
  process.env.E2E_SCREENSHOT_DIR &&
  path.join(process.env.E2E_SCREENSHOT_DIR, 'sportscode-import');
const screenshot = async (page, name) => {
  if (!artifacts) return;
  await fs.mkdir(artifacts, { recursive: true });
  await page.screenshot({
    path: path.join(artifacts, `${name}.png`),
    animations: 'disabled',
  });
};
const waitForTimeline = async () => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const page = app
      .windows()
      .find((page) => new URL(page.url()).hash === '#/timeline');
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('The native Timeline window did not open');
};
let app;
try {
  app = await electron.launch({
    ...getElectronLaunchOptions(path.join(root, 'profile')),
    timeout: 60000,
  });
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await app.evaluate(
    ({ dialog }, { xmlPath, videoPath, destination }) => {
      globalThis.importDialogCalls = [];
      globalThis.importDialogResponses = [
        xmlPath,
        videoPath,
        null,
        destination,
        destination,
      ];
      dialog.showOpenDialog = async (...args) => {
        globalThis.importDialogCalls.push(args.at(-1));
        const chosen = globalThis.importDialogResponses.shift();
        return { canceled: !chosen, filePaths: chosen ? [chosen] : [] };
      };
    },
    { xmlPath, videoPath, destination },
  );
  await main
    .getByRole('button', { name: 'Sportscode XMLから作成', exact: true })
    .click();
  const dialog = main.getByRole('dialog');
  await dialog.getByRole('button', { name: 'XMLを選択', exact: true }).click();
  await dialog.getByText('3行 / 2場面', { exact: false }).waitFor();
  await dialog
    .getByRole('button', { name: '対応する映像を選択', exact: true })
    .click();
  const confirm = dialog.getByRole('checkbox');
  await confirm.check();
  const create = dialog.getByRole('button', {
    name: '保存先を選んで作成',
    exact: true,
  });
  await create.click();
  await create.waitFor();
  assert.deepEqual(
    await fs.readdir(destination),
    [],
    'Cancelling the native destination picker must create nothing',
  );
  await dialog
    .getByRole('spinbutton', { name: 'XML時刻に加える秒数', exact: true })
    .fill('15');
  await confirm.check();
  await create.click();
  const rangeError = dialog
    .getByRole('alert')
    .filter({ hasText: '映像の長さを超えています' });
  await rangeError.waitFor();
  const errorBounds = await rangeError.boundingBox();
  const dialogBounds = await dialog.boundingBox();
  assert.ok(errorBounds && dialogBounds);
  assert.ok(
    errorBounds.y >= dialogBounds.y &&
      errorBounds.y + errorBounds.height <=
        dialogBounds.y + dialogBounds.height,
    'Import failure must remain visible inside the dialog without extra scrolling',
  );
  assert.deepEqual(
    await fs.readdir(destination),
    [],
    'Out-of-range XML must leave no partial project',
  );
  await screenshot(main, 'time-mismatch');
  await dialog
    .getByRole('spinbutton', { name: 'XML時刻に加える秒数', exact: true })
    .fill('0');
  await confirm.check();
  await screenshot(main, 'preview');
  await create.click();
  await dialog.waitFor({ state: 'hidden', timeout: 30000 });
  const packages = await fs.readdir(destination);
  assert.deepEqual(packages, ['Synthetic #%.stpkg']);
  const project = path.join(destination, packages[0]);
  const timeline = JSON.parse(
    await fs.readFile(path.join(project, 'timeline.json'), 'utf8'),
  );
  assert.equal(timeline.version, 2);
  assert.equal(timeline.instances.length, 2);
  assert.equal(timeline.rows.length, 3);
  assert.equal(timeline.instances[0].startTime, 4.25);
  assert.equal(timeline.instances[0].endTime, 8.75);
  assert.deepEqual(timeline.instances[0].labels.slice(0, 2), [
    { group: '位置', name: '中央' },
    { group: '方向', name: '中央' },
  ]);
  assert.equal(
    timeline.instances[0].memo,
    '架空の場面。#50% & 長いノート。\n2行目。',
  );
  assert.equal(timeline.rows[0].name, 'Falcon 守備');
  assert.equal(timeline.rows[1].color, '#ff8000');
  await main.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  const calls = await app.evaluate(() => globalThis.importDialogCalls);
  assert.deepEqual(calls[0].properties, ['openFile']);
  assert.deepEqual(calls[0].filters[0].extensions, ['xml']);
  assert.deepEqual(calls[1].filters[0].extensions, [
    'mov',
    'mp4',
    'm4v',
    'webm',
  ]);
  assert.deepEqual(calls[2].properties, [
    'openDirectory',
    'treatPackageAsDirectory',
  ]);
  assert.equal(calls[2].filters, undefined);
  assert.equal(await fs.readFile(xmlPath, 'utf8'), xml);
  assert.deepEqual(await fs.readFile(videoPath), originalVideo);
  assert.deepEqual(
    timeline.instances[0].labels.slice(-preservedLabels.length),
    preservedLabels,
  );
  const timelineWindow = await waitForTimeline();
  assert.ok(timelineWindow);
  await timelineWindow
    .getByRole('button', { name: 'Coral 攻撃 行', exact: true })
    .waitFor();
  await timelineWindow.evaluate(
    (id) =>
      window.electronAPI.timelineWindow.sendCommand({
        type: 'update-memo',
        id,
        memo: '再保存した合成ノート 🙂',
      }),
    timeline.instances[0].id,
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    const saved = JSON.parse(
      await fs.readFile(path.join(project, 'timeline.json'), 'utf8'),
    );
    if (saved.instances[0].memo === '再保存した合成ノート 🙂') {
      assert.deepEqual(saved.instances[0].labels, timeline.instances[0].labels);
      break;
    }
    if (attempt === 99) assert.fail('Actual renderer memo edit was not saved');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await screenshot(main, 'created');
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
  });
  await app.close();
  app = await electron.launch({
    ...getElectronLaunchOptions(path.join(root, 'profile'), [project]),
    timeout: 60000,
  });
  const reopened = await app.firstWindow();
  await reopened.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  const reopenedTimeline = await waitForTimeline();
  assert.ok(reopenedTimeline);
  await reopenedTimeline
    .getByRole('button', { name: 'Coral 攻撃 行', exact: true })
    .waitFor();
  const loadedInstances = await reopenedTimeline.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const api = window.electronAPI.timelineWindow;
        let unsubscribe = () => {};
        const callback = (payload) => {
          clearTimeout(timeout);
          unsubscribe();
          resolve(payload.timeline);
        };
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error('Cold Timeline sync did not arrive'));
        }, 10000);
        unsubscribe = api.onSync(callback);
        api.sendCommand({ type: 'request-sync' });
      }),
  );
  assert.deepEqual(loadedInstances[0].labels, timeline.instances[0].labels);
  assert.equal(loadedInstances[0].memo, '再保存した合成ノート 🙂');
  const reopenedDocument = JSON.parse(
    await fs.readFile(path.join(project, 'timeline.json'), 'utf8'),
  );
  assert.deepEqual(
    reopenedDocument.instances[0].labels,
    timeline.instances[0].labels,
  );
  assert.equal(reopenedDocument.instances[0].memo, '再保存した合成ノート 🙂');
  assert.equal(await fs.readFile(xmlPath, 'utf8'), xml);
  assert.deepEqual(await fs.readFile(videoPath), originalVideo);
  await screenshot(reopenedTimeline, 'reopened-label-groups');
  console.log(
    'Sportscode XML: explicit video, preserved groups/notes/colors/decimal times, cancelled picker, rejected out-of-range times, separate validated project; native picker options verified through adapter',
  );
} finally {
  if (app) {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      })
      .catch(() => {});
    await app.close().catch(() => {});
  }
  await fs.rm(root, { recursive: true, force: true });
}
