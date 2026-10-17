import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'unified-open-'));
const source = path.join(root, 'Synthetic project');
const target = path.join(root, 'Chosen destination.stpkg');
const artifacts = path.resolve(
  process.env.E2E_SCREENSHOT_DIR ?? 'output/playwright',
  'unified-open',
);
await fs.mkdir(artifacts, { recursive: true });
await fs.mkdir(path.join(source, '.metadata'), { recursive: true });
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=blue:s=320x180:r=30:d=4',
  '-c:v',
  fixtureH264Encoder,
  path.join(source, 'video.mp4'),
]);
const config = JSON.stringify({
  tightViewPath: path.join(source, 'video.mp4'),
});
const timeline = JSON.stringify([
  { id: 'event', actionName: 'Event', startTime: 1, endTime: 2 },
]);
await fs.writeFile(path.join(source, '.metadata/config.json'), config);
await fs.writeFile(path.join(source, 'timeline.json'), timeline);
let app;
try {
  for (let run = 0; run < 2; run++) {
    app = await electron.launch(
      getElectronLaunchOptions(path.join(root, 'profile')),
    );
    const main = await app.firstWindow();
    await main.waitForLoadState();
    await main.evaluate(() =>
      localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
    );
    await main.reload();
    await main
      .getByRole('button', { name: 'パッケージを開く', exact: true })
      .waitFor();
    assert.equal(
      await main
        .getByRole('button', { name: '旧SporTagフォルダを開く' })
        .count(),
      0,
    );
    // Seed an alternate destination using the real preparation/writer.
    if (!run) {
      const prepared = await main.evaluate(
        ({ source, target }) =>
          window.electronAPI.preparePackageForOpen(source, target),
        { source, target },
      );
      assert.equal(prepared.status, 'ready');
    }
    await main.screenshot({ path: path.join(artifacts, `open-${run}.png`) });
    // Only OS selection is stubbed. The common UI, preload, Main validation,
    // persistent index, session binding, real files and player remain real.
    await app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async (...args) => {
        const options = args.at(-1);
        if (!options.properties.includes('openDirectory') || options.filters)
          throw new Error(
            'Common picker must accept folders without format selection',
          );
        return { canceled: false, filePaths: [selected] };
      };
    }, source);
    await main
      .getByRole('button', { name: 'パッケージを開く', exact: true })
      .click();
    await main.waitForFunction(
      () => document.querySelector('#video_0 video')?.readyState >= 3,
      null,
      { timeout: 30000 },
    );
    console.log(
      'Open playback state',
      run,
      await main.locator('body').innerText(),
      await main.locator('video').evaluateAll((videos) =>
        videos.map((v) => ({
          paused: v.paused,
          time: v.currentTime,
          ready: v.readyState,
        })),
      ),
    );
    const play = main.getByRole('button', { name: '再生', exact: true });
    if (await play.count()) await play.click({ force: true });
    await main.waitForFunction(
      () => document.querySelector('#video_0 video')?.currentTime > 0.5,
    );
    assert.equal(
      (await fs.readdir(root)).filter((name) => name.endsWith('.stpkg')).length,
      1,
    );
    assert.equal(
      await fs.readFile(path.join(source, '.metadata/config.json'), 'utf8'),
      config,
    );
    assert.equal(
      await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
      timeline,
    );
    const prepared = await main.evaluate(
      (file) => window.electronAPI.preparePackageForOpen(file),
      source,
    );
    assert.equal(prepared.reused, true);
    assert.equal(prepared.packagePath, target);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    app = undefined;
  }
  console.log(
    'Unified open: one picker, alternate migrated target reused after process restart, playable output and unchanged original passed',
  );
} finally {
  if (app) {
    await app
      .evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
      )
      .catch(() => {});
    await app.close();
  }
  await fs.rm(root, { recursive: true, force: true });
}
