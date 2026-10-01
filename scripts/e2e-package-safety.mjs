import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { exercisePackageMigration } from './e2e-package-migration.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-safety-'));
const packagePath = path.join(root, 'Synthetic #%.stpkg');
const timelinePath = path.join(packagePath, 'timeline.json');
await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
await fs.mkdir(path.join(packagePath, 'videos'));
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
  path.join(packagePath, 'videos/synthetic.mp4'),
]);
const document = {
  version: 2,
  rows: [{ id: 'row', name: 'Coral 攻撃', color: '#4D8DFF' }],
  instances: [
    {
      id: 'scene',
      actionName: 'Coral 攻撃',
      startTime: 1.25,
      endTime: 3.5,
      memo: '架空ノート 🙂 #%',
      labels: [
        { name: '中央', group: '位置' },
        { name: '中央', group: '方向' },
      ],
    },
  ],
};
const original = JSON.stringify(document);
await fs.writeFile(timelinePath, original);
await fs.writeFile(
  path.join(packagePath, '.metadata/config.json'),
  JSON.stringify({
    packageFormatVersion: 1,
    team1Name: 'Coral',
    team2Name: 'Falcon',
    primaryAngleId: 'main',
    angles: [
      {
        id: 'main',
        name: 'Synthetic camera',
        sourceKind: 'local',
        relativePath: 'videos/synthetic.mp4',
        clips: [
          {
            id: 'clip',
            sourceKind: 'local',
            relativePath: 'videos/synthetic.mp4',
            gapBeforeSeconds: 0,
            timelineStartSeconds: 0,
            durationSeconds: 20,
          },
        ],
      },
    ],
  }),
);
const artifactDir =
  process.env.E2E_SCREENSHOT_DIR &&
  path.join(process.env.E2E_SCREENSHOT_DIR, 'package-safety');
const capture = async (page, name) => {
  if (!artifactDir) return;
  await fs.mkdir(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${name}.png`),
    animations: 'disabled',
  });
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
  await exercisePackageMigration(main, root, packagePath, document);
  await app.evaluate(async ({ ipcMain }, timelinePath) => {
    const { default: fs } = await import('node:fs/promises');
    globalThis.safetyReadFails = true;
    globalThis.safetyWriteFails = false;
    globalThis.safetyWrites = 0;
    ipcMain.removeHandler('read-text-file');
    ipcMain.handle('read-text-file', async (_event, file) =>
      file === timelinePath && globalThis.safetyReadFails
        ? '{broken'
        : fs.readFile(file, 'utf8').catch(() => null),
    );
    // Fault only the synthetic destination at the filesystem boundary; retain
    // the application's real IPC write handler and atomic writer.
    const rename = fs.rename.bind(fs);
    fs.rename = async (from, to) => {
      if (String(to) === timelinePath) {
        globalThis.safetyWrites++;
        if (globalThis.safetyWriteFails)
          throw Object.assign(new Error('synthetic EACCES'), {
            code: 'EACCES',
          });
      }
      return rename(from, to);
    };
  }, timelinePath);
  await app.evaluate(
    ({ app: nativeApp }, file) =>
      nativeApp.emit('open-file', { preventDefault() {} }, file),
    packagePath,
  );
  await main.getByRole('button', { name: '再読み込み', exact: true }).waitFor();
  let timeline;
  for (let attempt = 0; attempt < 100; attempt++) {
    timeline = app
      .windows()
      .find((page) => new URL(page.url()).hash === '#/timeline');
    if (timeline) break;
    await delay(50);
  }
  assert.ok(timeline);
  await timeline
    .getByRole('button', { name: '再読み込み', exact: true })
    .waitFor();
  await timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({
      type: 'add-row',
      name: 'Blocked edit',
      color: '#123456',
    }),
  );
  await delay(600);
  assert.equal(await app.evaluate(() => globalThis.safetyWrites), 0);
  assert.equal(
    await fs.readFile(timelinePath, 'utf8'),
    original,
    'A failed renderer read must preserve the complete original document',
  );
  await capture(main, 'read-error-main');
  await capture(timeline, 'read-error-timeline');
  await app.evaluate(() => {
    globalThis.safetyReadFails = false;
  });
  await timeline
    .getByRole('button', { name: '再読み込み', exact: true })
    .click();
  await main
    .getByRole('button', { name: '再読み込み', exact: true })
    .waitFor({ state: 'hidden' });
  await timeline
    .getByRole('button', { name: 'Coral 攻撃 行', exact: true })
    .waitFor();
  assert.equal(await fs.readFile(timelinePath, 'utf8'), original);
  await app.evaluate(() => {
    globalThis.safetyWriteFails = true;
  });
  await timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({
      type: 'update-memo',
      id: 'scene',
      memo: '未保存の変更 🙂',
    }),
  );
  await timeline
    .getByRole('button', { name: '保存を再試行', exact: true })
    .waitFor();
  await main
    .getByRole('button', { name: '保存を再試行', exact: true })
    .waitFor();
  assert.equal(await fs.readFile(timelinePath, 'utf8'), original);
  await capture(timeline, 'save-error-timeline');
  await app.evaluate(() => {
    globalThis.safetyWriteFails = false;
  });
  await timeline
    .getByRole('button', { name: '保存を再試行', exact: true })
    .click();
  await timeline
    .getByRole('button', { name: '保存を再試行', exact: true })
    .waitFor({ state: 'hidden' });
  const saved = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
  assert.equal(saved.instances[0].memo, '未保存の変更 🙂');
  assert.deepEqual(saved.instances[0].labels, document.instances[0].labels);
  assert.equal(saved.instances[0].startTime, 1.25);
  assert.equal(saved.instances[0].endTime, 3.5);
  const probe = path.join(root, 'atomic.json');
  await fs.writeFile(probe, '{"sequence":-1}');
  const writes = main.evaluate(async (file) => {
    await Promise.all(
      Array.from({ length: 12 }, (_, sequence) =>
        window.electronAPI.writeTextFile(
          file,
          JSON.stringify({ sequence, note: '合成 🙂'.repeat(12000) }),
        ),
      ),
    );
  }, probe);
  let reads = 0;
  for (let n = 0; n < 80; n++) {
    JSON.parse(await fs.readFile(probe, 'utf8'));
    reads++;
    await delay(10);
  }
  await writes;
  assert.equal(JSON.parse(await fs.readFile(probe, 'utf8')).sequence, 11);
  console.log(
    `Package safety: failed read retained original, errors/retries reached both windows, atomic concurrent writes remained valid across ${reads} reads`,
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
