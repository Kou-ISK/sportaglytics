import { getTimelineWindow } from './e2e-angle-sync-workspace.mjs';
import { createRequire } from 'node:module';
import { exercisePackageUpdateCrash } from './e2e-package-update-crash.mjs';
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
// Reproduce the already shipped 0.17.9 writer/index, then edit that copy.
const require = createRequire(import.meta.url);
const {
  prepareLegacyPackageCopy,
} = require('../build/electron/src/ipc/legacyPackageCopyService.js');
const {
  PackageMigrationIndex,
} = require('../build/electron/src/ipc/packageMigrationIndex.js');
await prepareLegacyPackageCopy(
  source,
  target,
  new PackageMigrationIndex(
    path.join(root, 'profile', 'package-migrations.json'),
  ),
);
const edited = JSON.parse(
  await fs.readFile(path.join(target, 'timeline.json'), 'utf8'),
);
edited.instances[0].memo = 'Saved in the earlier copy';
await fs.writeFile(path.join(target, 'timeline.json'), JSON.stringify(edited));
await exercisePackageUpdateCrash();
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
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => {
        throw new Error(
          'A known single copy and a successful update must not interrupt Open with a modal',
        );
      };
    });
    if (!run) {
      assert.equal(
        await main.evaluate(
          (file) => window.electronAPI.bindPackageSession(file),
          target,
        ),
        true,
      );
      await assert.rejects(
        main.evaluate(
          (file) => window.electronAPI.preparePackageForOpen(file),
          source,
        ),
        /PACKAGE_UPDATE_BUSY/,
      );
      await main.evaluate(
        (file) => window.electronAPI.releasePackageSession(file),
        target,
      );
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
    if (!run)
      await app.evaluate(() => {
        const fs = process.getBuiltinModule('fs/promises');
        const copy = fs.cp.bind(fs);
        fs.cp = async (...args) => {
          globalThis.updateCopyHeld = true;
          await new Promise((resolve) => {
            globalThis.releaseUpdateCopy = resolve;
          });
          fs.cp = copy;
          return copy(...args);
        };
      });
    await main
      .getByRole('button', { name: 'パッケージを開く', exact: true })
      .click();
    if (!run) {
      for (let attempt = 0; ; attempt++) {
        if (await app.evaluate(() => globalThis.updateCopyHeld)) break;
        if (attempt === 199) throw new Error('Update did not reach staging');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      for (const file of [source, target])
        assert.equal(
          await main.evaluate(
            (value) => window.electronAPI.bindPackageSession(value),
            file,
          ),
          false,
          'The real Main handler must refuse binding either package during staging',
        );
      await app.evaluate(() => globalThis.releaseUpdateCopy());
    }
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
    const backups = (await fs.readdir(root)).filter((name) =>
      name.includes('.backup-'),
    );
    assert.equal(backups.length, 1);
    const backup = path.join(
      root,
      backups[0],
      'original',
      path.basename(source),
    );
    assert.equal(
      await fs.readFile(path.join(backup, '.metadata/config.json'), 'utf8'),
      config,
    );
    assert.equal(
      await fs.readFile(path.join(backup, 'timeline.json'), 'utf8'),
      timeline,
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(source, 'timeline.json'), 'utf8'))
        .instances[0].memo,
      run ? 'Saved at the original path' : 'Saved in the earlier copy',
    );
    if (!run) {
      const timelineWindow = await getTimelineWindow(app);
      await timelineWindow
        .getByRole('slider', { name: 'タイムラインの再生位置' })
        .waitFor();
      await timelineWindow.evaluate(() =>
        window.electronAPI.timelineWindow.sendCommand({
          type: 'update-memo',
          id: 'event',
          memo: 'Saved at the original path',
        }),
      );
      for (let attempt = 0; ; attempt++) {
        const saved = JSON.parse(
          await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
        );
        if (saved.instances[0].memo === 'Saved at the original path') break;
        if (attempt === 99)
          throw new Error(
            'Actual renderer edit did not save at the original path',
          );
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(
        JSON.parse(
          await fs.readFile(path.join(target, 'timeline.json'), 'utf8'),
        ).instances[0].memo,
        'Saved in the earlier copy',
      );
    }
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(
        'show-package-backup',
      );
      if (!item) throw new Error('Backup recovery menu missing');
    });
    const prepared = await main.evaluate(
      (file) => window.electronAPI.preparePackageForOpen(file),
      source,
    );
    assert.equal(prepared.migrated, false);
    assert.equal(prepared.packagePath, await fs.realpath(source));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    app = undefined;
  }
  console.log(
    'Unified open: one picker, prior-copy edits adopted at original path, one retained backup, playback and process restart passed',
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
