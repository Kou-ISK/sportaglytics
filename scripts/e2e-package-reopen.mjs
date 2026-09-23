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
  path.join(os.tmpdir(), 'sportaglytics-reopen-'),
);
const packagePath = path.join(workPath, '再開 #50%.stpkg');
await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
await fs.mkdir(path.join(packagePath, 'videos'));
execFileSync(ffmpegPath, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=blue:s=320x180:d=3',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  '-y',
  path.join(packagePath, 'videos/video.mp4'),
]);
await fs.writeFile(
  path.join(packagePath, '.metadata/config.json'),
  JSON.stringify({
    team1Name: 'Red',
    team2Name: 'Blue',
    primaryAngleId: 'angle-1',
    angles: [
      {
        id: 'angle-1',
        name: 'Angle 1',
        sourceKind: 'local',
        relativePath: 'videos/video.mp4',
      },
    ],
  }),
);
await fs.writeFile(
  path.join(packagePath, 'timeline.json'),
  JSON.stringify({
    version: 2,
    rows: [{ id: 'attack', name: 'Attack', color: '#ff5500' }],
    instances: [
      { id: 'one', actionName: 'Attack', startTime: 0.5, endTime: 1.5 },
    ],
  }),
);

const app = await electron.launch(
  getElectronLaunchOptions(path.join(workPath, 'profile')),
);
app.process().stderr.on('data', (data) => process.stderr.write(data));
const dropPackage = async (page, files = [packagePath], items = []) => {
  const zone = page.getByRole('main', { name: '分析を開始' });
  await zone.waitFor();
  const box = await zone.boundingBox();
  assert.ok(box);
  const cdp = await page.context().newCDPSession(page);
  try {
    // Native file-backed drag data exercises Chromium -> preload, unlike new File().
    for (const type of ['dragEnter', 'dragOver', 'drop']) {
      await cdp.send('Input.dispatchDragEvent', {
        type,
        x: box.x + 20,
        y: box.y + 20,
        data: { items, files, dragOperationsMask: 1 },
      });
    }
  } finally {
    await cdp.detach();
  }
};
// Auxiliary windows can finish opening while a previous package is closing.
// Select the launcher by its navigated route, not the next raw window event.
const waitForMainWindow = () =>
  app.waitForEvent('window', {
    timeout: 20000,
    predicate: async (candidate) => {
      try {
        await candidate.waitForURL((url) => url.protocol !== 'about:', {
          timeout: 10000,
        });
        return new URL(candidate.url()).hash === '';
      } catch {
        return false;
      }
    },
  });

const waitForVideo = async (page) => {
  await page.locator('#video_0_html5_api').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return video instanceof HTMLVideoElement && video.readyState >= 2;
  });
};
try {
  const first = await app.firstWindow();
  await first.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await first.reload();
  await dropPackage(first, [], [{ mimeType: 'text/plain', data: packagePath }]);
  assert.equal(
    await first.getByRole('alert').count(),
    0,
    'Text input must not report an invalid package',
  );
  await dropPackage(first, [path.join(packagePath, 'videos/video.mp4')]);
  await first
    .getByText('ドロップしたファイルを確認してください', { exact: true })
    .waitFor();
  assert.equal(
    await first
      .getByRole('alert')
      .getByText(/外付けドライブ/)
      .count(),
    0,
  );
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await first.screenshot({
      path: path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'package-drop-guidance.png',
      ),
    });
  }
  await dropPackage(first);
  await waitForVideo(first);
  console.log('Native .stpkg directory drop passed');

  // did-finish-load can precede isLoading() becoming false. An OS open in
  // that interval must not wait for a second did-finish-load notification.
  await first.evaluate(
    (filePath) => window.electronAPI.releasePackageSession(filePath),
    packagePath,
  );
  const firstWindowId = await (await app.browserWindow(first)).evaluate(
    (window) => window.id,
  );
  const loadingAtFinish = await app.evaluate(
    ({ BrowserWindow, app: application }, { id, filePath }) =>
      new Promise((resolve, reject) => {
        const window = BrowserWindow.fromId(id);
        if (!window) return reject(new Error('Package window is missing'));
        window.webContents.once('did-finish-load', () => {
          const loading = window.webContents.isLoading();
          application.emit('open-file', { preventDefault() {} }, filePath);
          resolve(loading);
        });
        window.reload();
      }),
    { id: firstWindowId, filePath: packagePath },
  );
  await waitForVideo(first);
  console.log(`Native open at did-finish-load passed (loading=${loadingAtFinish})`);

  // Keep an independent window so this lifecycle also runs on Windows without quitting.
  const keeperPagePromise = app.waitForEvent('window');
  const keeperId = await app.evaluate(async ({ BrowserWindow }) => {
    const keeper = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    await keeper.loadURL('about:blank');
    return keeper.id;
  });
  await keeperPagePromise;
  const closed = first.waitForEvent('close');
  await (await app.browserWindow(first)).evaluate((window) => window.close());
  await closed;
  const windowsAfterClose = await app.evaluate(async ({ BrowserWindow }) => {
    const deadline = Date.now() + 5000;
    while (BrowserWindow.getAllWindows().length > 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return BrowserWindow.getAllWindows().length;
  });
  assert.equal(
    windowsAfterClose,
    1,
    'Closing the video must dispose its owned windows as well',
  );
  const reopenedPromise = waitForMainWindow();
  await app.evaluate(({ app: application }, filePath) => {
    application.emit('open-file', { preventDefault() {} }, filePath);
  }, packagePath);
  const reopened = await reopenedPromise;
  await waitForVideo(reopened);
  console.log('Closed package reopens through the external-open router');
  await app.evaluate(
    ({ BrowserWindow }, id) => BrowserWindow.fromId(id)?.destroy(),
    keeperId,
  );

  if (process.platform === 'darwin') {
    let current = reopened;
    for (const method of ['recent', 'drop', 'dialog']) {
      const closed = current.waitForEvent('close');
      await (
        await app.browserWindow(current)
      ).evaluate((window) => window.close());
      await closed;
      await app.evaluate(async ({ BrowserWindow }) => {
        const deadline = Date.now() + 5000;
        while (
          BrowserWindow.getAllWindows().length > 0 &&
          Date.now() < deadline
        ) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (BrowserWindow.getAllWindows().length)
          throw new Error('Owned windows did not close');
      });
      const launcherPromise = waitForMainWindow();
      await app.evaluate(({ app: application }) =>
        application.emit('activate'),
      );
      current = await launcherPromise;
      await current.getByRole('main', { name: '分析を開始' }).waitFor();
      if (method === 'drop') await dropPackage(current);
      else if (method === 'recent') {
        await current
          .getByRole('list', { name: '最近開いたパッケージ一覧' })
          .getByRole('button')
          .first()
          .click();
      } else {
        await app.evaluate(({ dialog }, filePath) => {
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [filePath],
          });
        }, packagePath);
        await current
          .getByRole('button', { name: 'パッケージを開く', exact: true })
          .click();
      }
      await waitForVideo(current);
      console.log(`Closed package reopens through ${method}`);
    }
  }
} catch (error) {
  console.error('Package reopen E2E failed:', error);
  for (const page of app.windows()) {
    if (!page.isClosed())
      console.error(
        page.url(),
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
