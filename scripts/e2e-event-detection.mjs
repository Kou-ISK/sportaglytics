import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const workPath = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-event-e2e-'),
);
const packageName = '試合 #50%';
const packagePath = path.join(workPath, `${packageName}.stpkg`);
const sources = ['前半.MP4', '後半.mp4'].map((name) => {
  const output = path.join(workPath, name);
  execFileSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=160x90:d=1',
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    '-y',
    output,
  ]);
  return output;
});
let app = await electron.launch(
  getElectronLaunchOptions(path.join(workPath, 'profile')),
);
try {
  const page = await app.firstWindow();
  const mainHandle = await app.browserWindow(page);
  const mainWindowId = await mainHandle.evaluate((window) => window.id);
  await mainHandle.dispose();
  await page.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await page.reload();
  await page.getByRole('img', { name: 'SporTagLytics アプリロゴ' }).waitFor();
  assert.equal(
    await page
      .getByRole('img', { name: 'SporTagLytics アプリロゴ' })
      .evaluate(
        (image) =>
          image.complete &&
          image.naturalWidth > 0 &&
          image.src.endsWith('/icon.png'),
      ),
    true,
  );
  await app.evaluate(
    ({ dialog, ipcMain }, { sources, workPath }) => {
      dialog.showOpenDialog = async (_window, options) => ({
        canceled: false,
        filePaths: options.properties.includes('openDirectory')
          ? [workPath]
          : sources,
      });
      // A deterministic model stub checks real input files. This scenario verifies
      // the wizard -> detection -> Timeline contract, not model accuracy.
      const fs = process.getBuiltinModule('fs');
      ipcMain.removeHandler('event-detection:list-models');
      globalThis.e2eEventModelLoads = 0;

      ipcMain.handle('event-detection:list-models', () => {
        globalThis.e2eEventModelLoads += 1;
        return [
          {
            id: 'e2e-input-contract',
            version: '1',
            displayName: 'E2E Input Contract',
            status: 'experimental',
            evaluationBasis: 'reference-coding',
            events: ['lineout'],
            metrics: {
              lineout: {
                precision: 1,
                recall: 1,
                evaluatedMatches: 1,
                confidenceThreshold: 0.5,
              },
            },
          },
        ];
      });
      ipcMain.removeHandler('event-detection:run');
      ipcMain.handle('event-detection:run', async (_event, request) => {
        for (const clip of request.clips) {
          if (!fs.existsSync(clip.videoPath))
            throw new Error(`video file is missing for clip ${clip.clipId}`);
          if (!fs.statSync(clip.videoPath).isFile())
            throw new Error('Input must be a file');
          fs.accessSync(clip.videoPath, fs.constants.R_OK);
        }
        globalThis.e2eEventRequest = request;
        await new Promise((resolve) => {
          globalThis.e2eFinishDetection = resolve;
        });
        const clip = request.clips.at(-1);
        return {
          requestId: request.requestId,
          modelId: request.modelId,
          modelVersion: request.modelVersion,
          candidates: [
            {
              id: 'e2e-event',
              eventType: 'lineout',
              confidence: 0.99,
              anchorTime: clip.timelineStartSeconds + 0.5,
              clipId: clip.clipId,
            },
          ],
          durationMs: 1,
        };
      });
    },
    { sources, workPath },
  );

  await page
    .getByRole('button', { name: '新しいパッケージを作成', exact: true })
    .click();
  await page.getByLabel('パッケージ').fill(packageName);
  await page.getByLabel('Team 1').fill('Red');
  await page.getByLabel('Team 2').fill('Blue');
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: 'このアングルに映像を追加' }).click();
  await page.getByRole('menuitem', { name: /ローカル映像/ }).click();
  await page.getByText('前半.MP4', { exact: true }).waitFor();
  await page.getByText('後半.mp4', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'パッケージを作成…' }).click();
  await page.locator('#video_0').waitFor({ timeout: 30000 });
  // Metadata loading updates the angle and window layout. Wait for playable
  // media before clicking the detection dialog so it cannot move mid-click.
  await page.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return video instanceof HTMLVideoElement && video.readyState >= 2;
  });
  const openDetection = () =>
    app.evaluate(({ BrowserWindow, Menu }, windowId) => {
      const main = BrowserWindow.fromId(windowId);
      main?.focus();
      const find = (items) => {
        for (const item of items) {
          if (item.label === '自動イベント検出…') return item;
          const found = item.submenu && find(item.submenu.items);
          if (found) return found;
        }
      };
      const item = find(Menu.getApplicationMenu().items);
      if (!item) throw new Error('Event detection menu is missing');
      item.click(item, main);
    }, mainWindowId);
  // Playback readiness can precede the final single-angle layout and native
  // aspect update. Compare the settled video window, not its startup geometry.
  const beforeBounds = await app.evaluate(
    async ({ BrowserWindow, app: application }, windowId) => {
      const main = BrowserWindow.fromId(windowId);
      application.focus({ steal: true });
      main.focus();
      let bounds = main.getBounds(),
        stableSince = Date.now();
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const current = main.getBounds();
        if (JSON.stringify(current) !== JSON.stringify(bounds)) {
          bounds = current;
          stableSince = Date.now();
        }
        const [width, height] = main.getContentSize();
        if (
          Math.abs(width / height - 16 / 9) < 0.01 &&
          Date.now() - stableSince >= 600
        )
          return bounds;
      }
      throw new Error('Video window geometry did not settle');
    },
    mainWindowId,
  );
  const detectionPromise = app.waitForEvent('window', (window) =>
    window.url().includes('/event-detection'),
  );
  await openDetection();
  const detectionPage = await detectionPromise;
  const detection = detectionPage.getByRole('main', {
    name: '自動イベント検出',
    exact: true,
  });
  await detection.getByText(/E2E Input Contract/).waitFor();
  await detection.getByText('モデルの評価・注意点', { exact: true }).click();
  await detection.getByText('既存Codingとの比較', { exact: true }).waitFor();
  assert.equal(await detection.getByText(/Precision/).count(), 0);
  await detection
    .getByRole('button', { name: '検出してタイムラインへ追加' })
    .click();
  await detection
    .getByRole('button', { name: 'バックグラウンドで続行' })
    .waitFor();
  // Closing the native surface preserves the in-flight operation and its form.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((window) =>
        window.webContents.getURL().includes('/event-detection'),
      )
      .close(),
  );
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) =>
          window.webContents.getURL().includes('/event-detection'),
        )
        .isVisible(),
    ),
    false,
  );
  await openDetection();
  await detection
    .getByRole('button', { name: 'バックグラウンドで続行' })
    .waitFor();
  assert.equal(
    app.windows().filter((window) => window.url().includes('/event-detection'))
      .length,
    1,
  );
  await app.evaluate(() => globalThis.e2eFinishDetection());
  await detection
    .getByText(/1件をタイムラインに追加しました/)
    .waitFor({ timeout: 10000 });

  assert.equal(
    await app.evaluate(() => globalThis.e2eEventModelLoads),
    1,
    'Metadata and coding updates must not reload the open detection form',
  );
  const request = await app.evaluate(() => globalThis.e2eEventRequest);
  const config = JSON.parse(
    await fs.readFile(
      path.join(packagePath, '.metadata', 'config.json'),
      'utf8',
    ),
  );
  assert.equal(request.clips.length, 2);
  assert.deepEqual(
    request.clips.map((clip) => path.normalize(clip.videoPath)),
    config.angles[0].clips.map((clip) =>
      path.join(packagePath, clip.relativePath),
    ),
  );
  assert.equal(
    request.clips[1].timelineStartSeconds,
    config.angles[0].clips[1].timelineStartSeconds,
  );
  const recent = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sportaglytics-recent-packages')),
  );
  assert.equal(path.normalize(recent[0].path), packagePath);
  const deadline = Date.now() + 5000;
  let timeline;
  do {
    timeline = JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    );
    if (timeline.instances?.length === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.equal(
    timeline.instances.length,
    1,
    'The detected event must be persisted',
  );
  assert.equal(timeline.instances[0].actionName, 'Lineout');
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await detectionPage.screenshot({
      path: path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'event-detection-created-package.png',
      ),
    });
  }
  assert.deepEqual(
    await app.evaluate(
      ({ BrowserWindow }, windowId) =>
        BrowserWindow.fromId(windowId).getBounds(),
      mainWindowId,
    ),
    beforeBounds,
  );
  await app.evaluate(({ BrowserWindow }) => {
    const child = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes('/event-detection'),
    );
    child.setSize(680, 480);
  });
  await detectionPage.waitForFunction(() => window.innerWidth <= 680);
  const runBounds = await detection
    .getByRole('button', { name: '検出してタイムラインへ追加' })
    .boundingBox();
  assert.ok(
    runBounds &&
      runBounds.y + runBounds.height <=
        (await detectionPage.evaluate(() => window.innerHeight)),
  );
  assert.equal(
    await detectionPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  // Headless desktop runners may expose no OS-focused window. Dispatch at
  // Electron's app boundary and exercise the production handler + native moveTop.
  // This verifies raising order and no focus mutation, not the desktop compositor.
  const activation = await app.evaluate(
    ({ BrowserWindow, app: application }) => {
      const raised = [];
      const focusedBefore = BrowserWindow.getFocusedWindow()?.id;
      for (const window of BrowserWindow.getAllWindows()) {
        const moveTop = window.moveTop.bind(window);
        window.moveTop = () => {
          raised.push(window.id);
          moveTop();
        };
      }
      const target = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes('/timeline'),
      );
      if (!target) throw new Error('Timeline window is missing');
      application.emit('browser-window-focus', {}, target);
      return {
        raised,
        visible: BrowserWindow.getAllWindows()
          .filter((window) => window.isVisible() && !window.isMinimized())
          .map((window) => window.id),
        target: target.id,
        focusedBefore,
        focusedAfter: BrowserWindow.getFocusedWindow()?.id,
        alwaysOnTop: BrowserWindow.getAllWindows().some((window) =>
          window.isAlwaysOnTop(),
        ),
      };
    },
  );
  assert.ok(
    activation.visible.every((id) => activation.raised.includes(id)),
    JSON.stringify(activation),
  );
  assert.equal(activation.raised.at(-1), activation.target);
  assert.equal(activation.focusedAfter, activation.focusedBefore);
  assert.equal(activation.alwaysOnTop, false);
  console.log(
    'New package video paths, detection input, history and Timeline persistence passed',
  );
  // Reproduce history written by versions that omitted the .stpkg suffix.
  await page.evaluate(
    (legacyPath) => {
      const recent = JSON.parse(
        localStorage.getItem('sportaglytics-recent-packages'),
      );
      recent[0].path = legacyPath;
      localStorage.setItem(
        'sportaglytics-recent-packages',
        JSON.stringify(recent),
      );
    },
    path.join(workPath, packageName),
  );
  await app.evaluate(({ app: application }) => application.exit(0));
  await app.close();
  app = await electron.launch(
    getElectronLaunchOptions(path.join(workPath, 'profile')),
  );
  const reopened = await app.firstWindow();
  await reopened
    .getByRole('list', { name: '最近開いたパッケージ一覧' })
    .getByRole('button')
    .first()
    .click();
  await reopened.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return video instanceof HTMLVideoElement && video.readyState >= 2;
  });
  console.log(
    'Legacy history without the package suffix reopens the actual package',
  );
} catch (error) {
  for (const page of app.windows()) {
    if (!page.isClosed())
      console.error(
        await page
          .locator('body')
          .innerText()
          .catch(() => ''),
      );
  }
  throw error;
} finally {
  await app
    .evaluate(({ app: application }) => application.exit(0))
    .catch(() => {});
  await app.close();
  await fs.rm(workPath, { recursive: true, force: true });
}
