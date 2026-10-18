import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { getTimelineWindow } from './e2e-angle-sync-workspace.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';
const root = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-external-'),
);
const videoPath = path.join(root, 'Original outside #%.mp4');
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
const video = await fs.readFile(videoPath);
await fs.chmod(videoPath, 0o444);
let app;
try {
  for (const [name, reference] of [
    ['absolute', videoPath],
    ['file-uri', pathToFileURL(videoPath).href],
  ]) {
    console.log(`Legacy external video reference: ${name}`);
    const source = path.join(root, `Legacy ${name}`);
    await fs.mkdir(path.join(source, '.metadata'), { recursive: true });
    const config = JSON.stringify({
      tightViewPath: reference,
      team1Name: 'Coral',
      team2Name: 'Falcon',
    });
    const timeline = JSON.stringify([
      {
        id: 'tag',
        actionName: 'Coral 攻撃',
        startTime: 1.25,
        endTime: 3.5,
        memo: '外部映像の合成場面',
        labels: [
          { name: 'same', group: '__proto__' },
          { name: 'other', group: 'constructor' },
        ],
      },
    ]);
    await fs.writeFile(path.join(source, '.metadata/config.json'), config);
    await fs.writeFile(path.join(source, 'timeline.json'), timeline);
    app = await electron.launch({
      ...getElectronLaunchOptions(path.join(root, `profile-${name}`)),
      timeout: 60000,
    });
    const main = await app.firstWindow();
    await main.evaluate(() =>
      localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
    );
    await main.reload();
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async (...args) => {
        const options = args.at(-1);
        if (options.title !== 'ファイルを開く')
          throw new Error('Unexpected dialog');
        const response =
          options.message === '開く内容を確認'
            ? options.buttons.indexOf('この場所の内容を使う')
            : 0;
        return { response, checkboxChecked: false };
      };
    });
    const prepared = await main.evaluate(
      (source) => window.electronAPI.preparePackageForOpen(source),
      source,
    );
    assert.equal(prepared.status, 'ready');
    assert.equal(prepared.migrated, true);
    assert.equal(prepared.packagePath, await fs.realpath(source));
    const copied = JSON.parse(
      await fs.readFile(
        path.join(prepared.packagePath, '.metadata/config.json'),
        'utf8',
      ),
    );
    assert.equal(copied.angles[0].clips[0].relativePath, reference);
    await app.evaluate(
      ({ app }, file) => app.emit('open-file', { preventDefault() {} }, file),
      prepared.packagePath,
    );
    await main.waitForFunction(
      () => document.querySelector('video')?.readyState >= 2,
      null,
      { timeout: 20000 },
    );
    const actual = await main.evaluate(() => ({
      source: document.querySelector('video').currentSrc,
      duration: document.querySelector('video').duration,
    }));
    assert.equal(new URL(actual.source).protocol, 'file:');
    assert.equal(
      await fs.realpath(fileURLToPath(actual.source)),
      await fs.realpath(videoPath),
    );
    assert.ok(actual.duration >= 19.9 && actual.duration <= 20.1);
    const timelineWindow = await getTimelineWindow(app);
    await timelineWindow
      .getByRole('slider', { name: 'タイムラインの再生位置' })
      .waitFor();
    // The package controller owns playback and its clock. A direct video.play()
    // would race its paused state instead of exercising the migrated project.
    await timelineWindow.evaluate(() =>
      window.electronAPI.timelineWindow.sendCommand({
        type: 'seek',
        time: 6.25,
      }),
    );
    await main.waitForFunction(() => {
      const video = document.querySelector('video');
      return (
        video.paused &&
        !video.seeking &&
        Math.abs(video.currentTime - 6.25) < 0.05
      );
    });
    await main.getByRole('button', { name: '再生', exact: true }).click();
    await main.waitForFunction(() => {
      const video = document.querySelector('video');
      return !video.paused && video.currentTime > 6.3;
    });
    await main.getByRole('button', { name: '一時停止', exact: true }).click();
    await main.waitForFunction(() => {
      const video = document.querySelector('video');
      return video.paused && !video.seeking;
    });
    assert.equal(
      await fs.readFile(
        path.join(prepared.backupPath, '.metadata/config.json'),
        'utf8',
      ),
      config,
    );
    assert.equal(
      await fs.readFile(
        path.join(prepared.backupPath, 'timeline.json'),
        'utf8',
      ),
      timeline,
    );
    assert.deepEqual(await fs.readFile(videoPath), video);
    if (process.platform !== 'win32')
      assert.equal((await fs.stat(videoPath)).mode & 0o777, 0o444);
    if (process.env.E2E_SCREENSHOT_DIR) {
      const artifacts = path.join(
        process.env.E2E_SCREENSHOT_DIR,
        'legacy-external',
      );
      await fs.mkdir(artifacts, { recursive: true });
      await main.screenshot({
        path: path.join(artifacts, `${name}-playing.png`),
        animations: 'disabled',
      });
    }
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) window.destroy();
    });
    await app.close();
    app = undefined;
  }
  console.log(
    'Legacy external video: original absolute path and file URI retained, same-path project playback/seek succeeded, backup and read-only external media unchanged',
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
