import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
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
    await fs.chmod(path.join(source, '.metadata/config.json'), 0o444);
    await fs.chmod(path.join(source, 'timeline.json'), 0o444);
    app = await electron.launch({
      ...getElectronLaunchOptions(path.join(root, `profile-${name}`)),
      timeout: 60000,
    });
    const main = await app.firstWindow();
    await main.evaluate(() =>
      localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
    );
    await main.reload();
    const prepared = await main.evaluate(
      (source) => window.electronAPI.preparePackageForOpen(source),
      source,
    );
    assert.equal(prepared.status, 'ready');
    assert.equal(prepared.migrated, true);
    assert.notEqual(prepared.packagePath, source);
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
    assert.equal(new URL(actual.source).href, pathToFileURL(videoPath).href);
    assert.ok(actual.duration >= 19.9 && actual.duration <= 20.1);
    await main.evaluate(async () => {
      const video = document.querySelector('video');
      video.currentTime = 6.25;
      await video.play();
    });
    await main.waitForFunction(
      () => document.querySelector('video').currentTime > 6.3,
    );
    await main.evaluate(() => document.querySelector('video').pause());
    assert.equal(
      await fs.readFile(path.join(source, '.metadata/config.json'), 'utf8'),
      config,
    );
    assert.equal(
      await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
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
    'Legacy external video: original absolute path and file URI retained, actual copied project playback/seek succeeded, read-only originals unchanged',
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
