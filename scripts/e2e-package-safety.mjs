import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import {
  getElectronLaunchOptions,
  observeElectronErrors,
} from './e2e-electron-launch.mjs';
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
const waitForTimeline = async (previousWindows = new Set()) => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const page = app
      .windows()
      .find(
        (page) =>
          !previousWindows.has(page) &&
          new URL(page.url()).hash === '#/timeline',
      );
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
  observeElectronErrors(app);
  let main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await exercisePackageMigration(main, root, packagePath, document);
  await app.evaluate(async ({ ipcMain }, timelinePath) => {
    const fs = process.getBuiltinModule('fs/promises');
    const path = process.getBuiltinModule('path');
    globalThis.safetyTargetPath = timelinePath;
    globalThis.safetyHoldWrite = false;
    globalThis.safetyHeldWrite = false;
    globalThis.safetyReadFails = true;
    globalThis.safetyWriteFails = false;
    globalThis.safetyWrites = 0;
    globalThis.safetyCommits = 0;
    globalThis.safetyReadHits = 0;
    ipcMain.removeHandler('read-text-file');
    ipcMain.handle('read-text-file', async (_event, file) => {
      if (
        typeof file === 'string' &&
        path.resolve(file) === path.resolve(globalThis.safetyTargetPath) &&
        globalThis.safetyReadFails
      ) {
        globalThis.safetyReadHits++;
        return '{broken';
      }
      return fs.readFile(file, 'utf8').catch(() => null);
    });
    // Fault only the synthetic destination at the filesystem boundary; retain
    // the application's real IPC write handler and atomic writer.
    const rename = fs.rename.bind(fs);
    fs.rename = async (from, to) => {
      if (
        path.resolve(String(to)) === path.resolve(globalThis.safetyTargetPath)
      ) {
        globalThis.safetyWrites++;
        if (globalThis.safetyHoldWrite) {
          globalThis.safetyHoldWrite = false;
          globalThis.safetyHeldWrite = true;
          await new Promise((resolve) => {
            globalThis.safetyReleaseWrite = resolve;
          });
          globalThis.safetyHeldWrite = false;
        }
        if (globalThis.safetyWriteFails)
          throw Object.assign(new Error('synthetic EACCES'), {
            code: 'EACCES',
          });
      }
      const result = await rename(from, to);
      if (
        path.resolve(String(to)) === path.resolve(globalThis.safetyTargetPath)
      )
        globalThis.safetyCommits++;
      return result;
    };
  }, timelinePath);
  await app.evaluate(
    ({ app: nativeApp }, file) =>
      nativeApp.emit('open-file', { preventDefault() {} }, file),
    packagePath,
  );
  await main.getByRole('button', { name: '再読み込み', exact: true }).waitFor();
  let timeline;
  for (let attempt = 0; attempt < 400; attempt++) {
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
  // Exercise Undo while the real atomic writer is at its final rename.
  for (const queuedBeforeRelease of [false, true]) {
    const commitsBefore = await app.evaluate(() => globalThis.safetyCommits);
    await app.evaluate(() => {
      globalThis.safetyHoldWrite = true;
    });
    await timeline.evaluate(
      (memo) =>
        window.electronAPI.timelineWindow.sendCommand({
          type: 'update-memo',
          id: 'scene',
          memo,
        }),
      `In-flight B ${queuedBeforeRelease}`,
    );
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await app.evaluate(() => globalThis.safetyHeldWrite)) break;
      if (attempt === 99) assert.fail('Synthetic held rename did not start');
      await delay(50);
    }
    await timeline.evaluate(() =>
      window.electronAPI.timelineWindow.sendCommand({ type: 'undo' }),
    );
    await delay(queuedBeforeRelease ? 400 : 50);
    await app.evaluate(() => globalThis.safetyReleaseWrite());
    for (let attempt = 0; attempt < 100; attempt++) {
      const restored = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
      if (
        (await app.evaluate(() => globalThis.safetyCommits)) >=
          commitsBefore + 2 &&
        restored.instances[0].memo === '未保存の変更 🙂'
      )
        break;
      if (attempt === 99)
        assert.fail('Undo left disk at the in-flight B snapshot');
      await delay(50);
    }
    assert.deepEqual(
      JSON.parse(await fs.readFile(timelinePath, 'utf8')).instances[0].labels,
      document.instances[0].labels,
    );
  }
  // Failed reads of an empty project must not seed history or pending coding.
  const savedFirstProject = await fs.readFile(timelinePath, 'utf8');
  const emptyProject = path.join(root, 'Empty retry.stpkg');
  await fs.cp(packagePath, emptyProject, { recursive: true });
  await fs.writeFile(
    path.join(emptyProject, '.metadata/package-id.json'),
    JSON.stringify({ version: 1, id: randomUUID() }),
  );
  const emptyPath = path.join(emptyProject, 'timeline.json');
  const emptyDocument = JSON.stringify({ version: 2, rows: [], instances: [] });
  await fs.writeFile(emptyPath, emptyDocument);
  await main.evaluate(async () => {
    const settings = await window.electronAPI.loadSettings();
    const layout = {
      id: 'safety-coding',
      name: 'Synthetic safety coding',
      canvasWidth: 800,
      canvasHeight: 600,
      buttons: [
        {
          id: 'synthetic-code',
          type: 'action',
          name: 'Coral Synthetic coding',
          x: 20,
          y: 20,
          width: 180,
          height: 50,
          hotkey: 'Q',
          leadTimeSeconds: 0,
          lagTimeSeconds: 0,
        },
      ],
    };
    assertSave(
      await window.electronAPI.saveSettings({
        ...settings,
        codingPanel: {
          ...settings.codingPanel,
          codeWindows: [layout],
          activeCodeWindowId: layout.id,
        },
      }),
    );
    function assertSave(success) {
      if (!success) throw new Error('Could not save synthetic settings');
    }
  });
  const previousWindows = new Set(app.windows());
  await app.evaluate((_electron, target) => {
    globalThis.safetyTargetPath = target;
    globalThis.safetyReadFails = true;
    globalThis.safetyWrites = 0;
    globalThis.safetyReadHits = 0;
  }, emptyPath);
  // Opening another package deliberately creates a separate session. Select
  // that session's Main and auxiliary windows, keeping the first project open.
  const nextMain = app.waitForEvent('window', {
    timeout: 20000,
    predicate: async (candidate) => {
      await candidate.waitForURL((url) => url.protocol !== 'about:', {
        timeout: 10000,
      });
      return new URL(candidate.url()).hash === '';
    },
  });
  await app.evaluate(
    ({ app }, file) => app.emit('open-file', { preventDefault() {} }, file),
    emptyProject,
  );
  main = await nextMain;
  assert.equal(previousWindows.has(main), false);
  await main.getByRole('button', { name: '再読み込み', exact: true }).waitFor();
  assert.ok(await app.evaluate(() => globalThis.safetyReadHits > 0));
  timeline = await waitForTimeline(previousWindows);
  await timeline
    .getByRole('button', { name: '再読み込み', exact: true })
    .waitFor();
  await main.evaluate(() => window.electronAPI.codingPanelWindow.openWindow());
  let coding;
  for (let attempt = 0; attempt < 200; attempt++) {
    coding = app
      .windows()
      .find(
        (page) =>
          !previousWindows.has(page) &&
          new URL(page.url()).hash === '#/coding-panel',
      );
    if (coding) break;
    await delay(50);
  }
  assert.ok(coding);
  const codeButton = coding.locator(
    '[data-code-window-button="synthetic-code"]',
  );
  await codeButton.waitFor();
  await coding
    .getByText(
      'タイムラインの読み込みが完了するまでタグ付けを停止しています。',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await codeButton.evaluate((element) =>
      element.closest('fieldset').hasAttribute('inert'),
    ),
    true,
  );
  await coding.evaluate(() => {
    window.electronAPI.codingPanelWindow.sendCommand({
      type: 'action-click',
      teamName: 'Coral',
      actionName: 'Synthetic coding',
    });
    window.electronAPI.codingPanelWindow.sendCommand({
      type: 'custom-button-click',
      buttonId: 'synthetic-code',
    });
  });
  await main.bringToFront();
  await main.waitForFunction(() => document.hasFocus());
  await main.keyboard.press('Q');
  await main.bringToFront();
  await main.waitForFunction(() => document.hasFocus());
  await main.keyboard.press('Q');
  await timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({
      type: 'create-item',
      actionName: 'Ghost',
      startTime: 1,
      endTime: 2,
      color: '#123456',
    }),
  );
  await delay(600);
  assert.equal(await app.evaluate(() => globalThis.safetyWrites), 0);
  assert.equal(await fs.readFile(emptyPath, 'utf8'), emptyDocument);
  await capture(coding, 'read-error-coding');
  await app.evaluate(() => {
    globalThis.safetyReadFails = false;
  });
  await main.getByRole('button', { name: '再読み込み', exact: true }).click();
  await main
    .getByRole('button', { name: '再読み込み', exact: true })
    .waitFor({ state: 'hidden' });
  await coding
    .getByText(
      'タイムラインの読み込みが完了するまでタグ付けを停止しています。',
      { exact: true },
    )
    .waitFor({ state: 'hidden' });
  assert.equal(
    await codeButton.evaluate((element) =>
      element.closest('fieldset').hasAttribute('inert'),
    ),
    false,
  );
  assert.equal(await fs.readFile(emptyPath, 'utf8'), emptyDocument);
  await timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({ type: 'seek', time: 6 }),
  );
  await main.waitForFunction(
    () => Math.abs(document.querySelector('video').currentTime - 6) < 0.1,
  );
  await main.bringToFront();
  await main.waitForFunction(() => document.hasFocus());
  await main.keyboard.press('Q');
  await timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({ type: 'seek', time: 7 }),
  );
  await main.waitForFunction(
    () => Math.abs(document.querySelector('video').currentTime - 7) < 0.1,
  );
  await main.bringToFront();
  await main.waitForFunction(() => document.hasFocus());
  await main.keyboard.press('Q');
  for (let attempt = 0; attempt < 100; attempt++) {
    const fresh = JSON.parse(await fs.readFile(emptyPath, 'utf8'));
    if (fresh.instances.length) {
      assert.equal(fresh.instances.length, 1);
      assert.equal(fresh.instances[0].actionName, 'Coral Synthetic coding');
      assert.ok(Math.abs(fresh.instances[0].startTime - 6) < 0.1);
      assert.ok(Math.abs(fresh.instances[0].endTime - 7) < 0.1);
      assert.deepEqual(
        fresh.rows.map((row) => row.name),
        ['Coral Synthetic coding'],
      );
      break;
    }
    if (attempt === 99) assert.fail('Fresh post-retry coding did not save');
    await delay(50);
  }
  assert.equal(
    await fs.readFile(timelinePath, 'utf8'),
    savedFirstProject,
    'The other project session must remain unchanged',
  );
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
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
  });
  await app.close();
  app = await electron.launch({
    ...getElectronLaunchOptions(path.join(root, 'profile'), [emptyProject]),
    timeout: 60000,
  });
  const reopened = await app.firstWindow();
  await reopened.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  const reopenedTimeline = await waitForTimeline();
  assert.ok(reopenedTimeline);
  await reopenedTimeline
    .getByRole('button', { name: 'Coral Synthetic coding 行', exact: true })
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
  assert.deepEqual(
    loadedInstances.map((item) => item.actionName),
    ['Coral Synthetic coding'],
  );
  await capture(reopenedTimeline, 'retry-empty-reopened');
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
