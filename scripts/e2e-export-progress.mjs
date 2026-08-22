import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const { ffmpegPath } = await import('./media-tool-paths.mjs');
const repositoryPath = path.resolve(import.meta.dirname, '..');
const workPath = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-export-progress-e2e-'),
);
const profilePath = path.join(workPath, 'profile');
const sourcePath = path.join(workPath, 'source.mp4');
const outputPath = path.join(workPath, 'output');
await fs.mkdir(outputPath);

execFileSync(ffmpegPath, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=1280x720:rate=30:duration=30',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=880:sample_rate=48000:duration=30',
  '-c:v',
  'h264_videotoolbox',
  '-b:v',
  '8M',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-shortest',
  '-y',
  sourcePath,
]);

const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...electronEnvironment } =
  process.env;
const electronApp = await electron.launch({
  executablePath: electronPath,
  args: [repositoryPath, `--user-data-dir=${profilePath}`],
  env: {
    ...electronEnvironment,
    NODE_ENV: 'test',
  },
});

try {
  const mainPage = await electronApp.firstWindow();
  await mainPage.evaluate(() => {
    localStorage.setItem('sportaglytics-onboarding-completed', 'true');
  });
  await mainPage.reload();
  await mainPage
    .getByText('新しいパッケージを作成', { exact: true })
    .waitFor();

  const progressWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await mainPage.evaluate(
    ({ source, output }) => {
      globalThis.__exportResult = undefined;
      void window.electronAPI
        .exportClipsWithOverlay?.({
          progressId: 'e2e-export-progress',
          sourcePath: source,
          mode: 'single',
          exportMode: 'single',
          angleOption: 'single',
          outputDir: output,
          outputFileName: 'progress-test',
          clips: [
            {
              id: 'progress-clip',
              actionName: 'Progress clip',
              startTime: 0,
              endTime: 30,
            },
          ],
          overlay: {
            enabled: true,
            showActionName: true,
            showActionIndex: false,
            showLabels: false,
            showMemo: false,
          },
        })
        .then((result) => {
          globalThis.__exportResult = result;
        });
    },
    { source: sourcePath, output: outputPath },
  );

  const progressPage = await progressWindowPromise;
  await progressPage.getByText('映像を書き出し中').waitFor({
    timeout: 10_000,
  });
  const focusedUrlAtStart = await electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getFocusedWindow()?.webContents.getURL(),
  );
  assert.ok(
    !focusedUrlAtStart?.endsWith('#/export-progress'),
    'the progress window must not take focus when export starts',
  );

  await mainPage
    .getByText('新しいパッケージを作成', { exact: true })
    .click();
  await mainPage.getByLabel('パッケージ').waitFor({ timeout: 5_000 });
  await mainPage.waitForTimeout(800);
  const focusedUrlAfterProgressUpdate = await electronApp.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getFocusedWindow()?.webContents.getURL(),
  );
  assert.ok(
    !focusedUrlAfterProgressUpdate?.endsWith('#/export-progress'),
    'progress updates must not steal focus from the main window',
  );

  const observedPercentages = [];
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const text =
      (await progressPage
        .getByTestId('export-progress-percent')
        .textContent()
        .catch(() => null)) ?? '';
    const percentage = Number.parseInt(text, 10);
    if (Number.isFinite(percentage)) observedPercentages.push(percentage);
    if ((await progressPage.getByText('書き出し完了').count()) > 0) break;
    await progressPage.waitForTimeout(100);
  }

  await progressPage.getByText('書き出し完了').waitFor({ timeout: 5_000 });
  const completedBarRatio = await progressPage
    .getByTestId('export-progress-bar')
    .evaluate((element) => {
      const track = element.getBoundingClientRect();
      const bar = element
        .querySelector('.MuiLinearProgress-bar')
        ?.getBoundingClientRect();
      return bar && track.width > 0 ? bar.width / track.width : 0;
    });
  const exportResult = await mainPage.evaluate(() => globalThis.__exportResult);
  assert.equal(exportResult?.success, true, exportResult?.error);
  assert.ok(
    observedPercentages.some((value) => value > 0 && value < 100),
    `real FFmpeg progress must include an intermediate value: ${observedPercentages.join(', ')}`,
  );
  assert.ok(
    observedPercentages.every(
      (value, index) => index === 0 || value >= observedPercentages[index - 1],
    ),
    `progress must be monotonic: ${observedPercentages.join(', ')}`,
  );
  assert.equal(observedPercentages.at(-1), 100);
  assert.ok(
    completedBarRatio >= 0.99,
    `completed progress bar must immediately be full width: ${completedBarRatio}`,
  );
  assert.ok(
    (await fs.readdir(outputPath)).some((name) => name.endsWith('.mp4')),
    'exported video must be written',
  );

  const screenshotDirectory = process.env.E2E_SCREENSHOT_DIR;
  if (screenshotDirectory) {
    await fs.mkdir(screenshotDirectory, { recursive: true });
    await mainPage.screenshot({
      path: path.join(screenshotDirectory, 'export-main-operable.png'),
    });
    await progressPage.screenshot({
      path: path.join(screenshotDirectory, 'export-progress-completed.png'),
    });
  }
  console.log('Non-modal export progress E2E passed');
} finally {
  await electronApp.close().catch(() => undefined);
}
