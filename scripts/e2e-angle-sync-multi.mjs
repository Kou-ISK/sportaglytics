import { getSyncTimeline } from './e2e-angle-sync-workspace.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'angle-sync-multi-'));
let app;
try {
  const source = path.join(dir, 'variable-frames.mp4');
  execFileSync(ffmpegPath, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=s=160x90:r=50:d=3',
    '-vf',
    "select='if(lt(t,1),not(mod(n,2)),1)',setpts=PTS+5/TB",
    '-fps_mode',
    'vfr',
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    '-y',
    source,
  ]);
  app = await electron.launch(
    getElectronLaunchOptions(path.join(dir, 'profile')),
  );
  let page = await app.firstWindow();
  await page.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  const frameWindow = await page.evaluate(
    (source) => window.electronAPI.readMediaFrameWindow(source, 6),
    source,
  );
  assert.ok(
    Math.abs(frameWindow.times[0] - 5) < 0.001,
    'frame timestamps keep the same media clock as the browser',
  );
  assert.ok(
    frameWindow.times.some(
      (time, i) =>
        i && Math.abs(time - frameWindow.times[i - 1] - 0.04) < 0.001,
    ),
  );
  assert.ok(
    frameWindow.times.some(
      (time, i) =>
        i && Math.abs(time - frameWindow.times[i - 1] - 0.02) < 0.001,
    ),
  );
  for (const count of [3, 4]) {
    await page.evaluate(
      async ({ dir, source, count }) =>
        window.electronAPI.createPackage(
          dir,
          `angles-${count}`,
          Array.from({ length: count }, (_, i) => ({
            id: `angle-${i}`,
            name: `Angle ${i + 1}`,
            clips: [
              {
                id: `source-${i}`,
                source,
                sourceKind: 'local',
                gapBeforeSeconds: 0,
              },
            ],
          })),
          { team1Name: 'Red', team2Name: 'Blue' },
        ),
      { dir, source, count },
    );
  }
  await app.close();
  for (const count of [3, 4]) {
    app = await electron.launch(
      getElectronLaunchOptions(path.join(dir, 'profile'), [
        path.join(dir, `angles-${count}.stpkg`),
      ]),
    );
    page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.locator('#video_0 video').waitFor();
    await page.keyboard.press(`${primaryModifier}+Shift+T`);
    const timeline = await getSyncTimeline(app);
    await page.waitForFunction((count) => {
      const surface = document.querySelector('[data-video-aspect-surface]');
      const rect = surface.getBoundingClientRect();
      return (
        surface.querySelectorAll('video').length === count &&
        Math.abs(rect.width / rect.height - 16 / 9) < 0.025
      );
    }, count);
    assert.equal(await page.getByRole('combobox').count(), 0);
    for (let index = 0; index < count; index++) {
      await timeline.keyboard.press(`Shift+${index + 1}`);
      const input = timeline.getByRole('textbox', { name: '再生タイムコード' });
      await input.fill('6.08');
      await input.press('Enter');
      await page.waitForFunction((index) => {
        const video = document.querySelector(`#sync_angle_${index} video`);
        return (
          video.readyState >= 2 &&
          !video.seeking &&
          Math.abs(video.currentTime - 6.08) < 0.001
        );
      }, index);
      if (index === 0) {
        await timeline
          .getByRole('button', { name: '1コマ進む', exact: true })
          .click();
        await page.waitForFunction(
          () =>
            Math.abs(
              document.querySelector('#sync_angle_0 video').currentTime -
                6.1001,
            ) < 0.001,
        );
        await timeline.keyboard.press('ArrowLeft');
        await page.waitForFunction(
          () =>
            Math.abs(
              document.querySelector('#sync_angle_0 video').currentTime -
                6.0801,
            ) < 0.001,
        );
      }
      await timeline
        .getByRole('button', { name: '同期点を設定', exact: true })
        .click();
      await timeline
        .getByLabel(`Angle ${index + 1}の同期点`, { exact: true })
        .waitFor();
    }
    await timeline.keyboard.press(`Shift+${count}`);
    await timeline
      .getByRole('button', { name: 'アングルを同期', exact: true })
      .click();
    const save = timeline.getByRole('button', {
      name: '保存して閉じる',
      exact: true,
    });
    const rect = await save.boundingBox();
    const height = await timeline.evaluate(() => innerHeight);
    assert.ok(rect.y + rect.height <= height);
    await fs.mkdir('output/playwright', { recursive: true });
    await page.screenshot({
      path: `output/playwright/angle-sync-${count}-angles.png`,
    });
    await save.click();
    await page
      .getByLabel('アングル同期ワークスペース', { exact: true })
      .waitFor({ state: 'hidden' });
    const config = JSON.parse(
      await fs.readFile(
        path.join(dir, `angles-${count}.stpkg`, '.metadata', 'config.json'),
        'utf8',
      ),
    );
    assert.deepEqual(config.syncData.angleOffsets, Array(count).fill(0));
    await app.close();
  }
  console.log(
    '3/4-angle layout, sync points and variable frame timestamps passed',
  );
} catch (error) {
  if (app) {
    const page = (await app.windows())[0];
    console.log(
      await app.evaluate(({ BrowserWindow, screen }) =>
        BrowserWindow.getAllWindows().map((w) => ({
          title: w.getTitle(),
          bounds: w.getBounds(),
          content: w.getContentBounds(),
          minimum: w.getMinimumSize(),
          maximized: w.isMaximized(),
          display: screen.getDisplayMatching(w.getBounds()).workArea,
        })),
      ),
    );
    console.log(
      await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        surface: document
          .querySelector('[data-video-aspect-surface]')
          ?.getBoundingClientRect()
          .toJSON(),
        videos: document.querySelectorAll('[data-video-aspect-surface] video')
          .length,
      })),
    );
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll('video')].map((v) => ({
          time: v.currentTime,
          duration: v.duration,
          ready: v.readyState,
          seeking: v.seeking,
          start: v.seekable.length ? v.seekable.start(0) : null,
        })),
      ),
    );
  }
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
}
