import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

export const getSyncTimeline = async (app) => {
  let timeline;
  const deadline = Date.now() + 15000;
  while (!timeline && Date.now() < deadline) {
    timeline = app.windows().find((item) => item.url().includes('#/timeline'));
    if (!timeline) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(timeline, 'Timeline window opened and navigated');
  await timeline
    .getByLabel('タイムラインのアングル同期', { exact: true })
    .waitFor();
  return timeline;
};

export const seekSyncTime = async (timeline, value) => {
  const input = timeline.getByRole('textbox', { name: '再生タイムコード' });
  await input.fill(String(value));
  await input.press('Enter');
};

export const exerciseAngleSync = async (
  page,
  app,
  angleKeys = ['Shift+1', 'Shift+2'],
) => {
  const normalTimeline = app
    .windows()
    .find((item) => item.url().includes('#/timeline'));
  const codingRowsBefore = await normalTimeline
    .locator('[data-testid^="timeline-lane-"]')
    .count();
  assert.ok(codingRowsBefore > 0, 'fixture includes ordinary Coding rows');
  const rulerBefore = await normalTimeline
    .getByTestId('timeline-ruler')
    .boundingBox();
  await normalTimeline
    .getByRole('button', { name: 'アングル同期', exact: true })
    .click();
  await page
    .getByLabel('アングル同期ワークスペース', { exact: true })
    .waitFor();
  const timeline = await getSyncTimeline(app);
  await page.evaluate(() => {
    const events = [];
    window.__angleSyncMediaEvents = events;
    for (const name of [
      'emptied',
      'loadedmetadata',
      'loadeddata',
      'canplay',
      'seeking',
      'seeked',
      'error',
      'stalled',
      'waiting',
    ]) {
      document.addEventListener(
        name,
        (event) => {
          const video = event.target;
          if (!(video instanceof HTMLVideoElement)) return;
          events.push({
            event: name,
            id: video.id,
            source: video.currentSrc.split(/[\\/]/).pop(),
            time: video.currentTime,
            ready: video.readyState,
            seeking: video.seeking,
          });
          if (events.length > 100) events.shift();
        },
        true,
      );
    }
  });
  assert.equal(
    await timeline.locator('[data-testid^="timeline-lane-"]').count(),
    codingRowsBefore,
  );
  const rulerAfter = await timeline.getByTestId('timeline-ruler').boundingBox();
  assert.equal(
    rulerAfter.y,
    rulerBefore.y,
    'sync uses the ordinary timeline toolbar without shifting the ruler',
  );
  assert.equal(
    await timeline.locator('[data-angle-track]').count(),
    0,
    'no separate sync lanes',
  );
  assert.equal(
    await page.getByRole('slider').count(),
    0,
    'video window has no second seek bar',
  );
  assert.equal(
    await timeline
      .getByRole('slider', { name: 'タイムラインの再生位置' })
      .count(),
    1,
  );
  assert.equal(
    await page.locator('video').count(),
    2,
    'one player per angle, with no background duplicates',
  );
  assert.equal(
    await page.getByRole('combobox').count(),
    0,
    'do not ask users to select source files',
  );
  assert.equal(await page.locator('video[controls]').count(), 0);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.vjs-modal-dialog')].every(
      (element) => getComputedStyle(element).display === 'none',
    ),
  );
  const assertLayout = async (expectedAspect) => {
    await page.waitForFunction((aspect) => {
      const media = document
        .querySelector('[data-video-aspect-surface]')
        .getBoundingClientRect();
      const workspace = document.querySelector(
        '[aria-label="アングル同期ワークスペース"]',
      );
      return (
        Math.abs(media.width / media.height - aspect) < 0.025 &&
        workspace.scrollHeight <= workspace.clientHeight + 1 &&
        workspace.scrollWidth <= workspace.clientWidth + 1
      );
    }, expectedAspect);
    for (const label of ['同期点を設定', 'アングルを同期', '保存して閉じる']) {
      const rect = await timeline
        .getByRole('button', { name: label, exact: true })
        .boundingBox();
      const viewport = await timeline.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
      }));
      assert.ok(
        rect.y >= 0 &&
          rect.y + rect.height <= viewport.height &&
          rect.x + rect.width <= viewport.width,
        label + ' is inside its actual window',
      );
    }
  };
  await assertLayout(32 / 9);
  console.log('Initial angle workspace layout passed');
  const seekSync = (value) => seekSyncTime(timeline, value);
  for (const pair of [
    { reference: 2, target: 2 },
    { reference: 9, target: 9 },
  ]) {
    console.log('Aligning period', pair.reference);
    await timeline.keyboard.press(angleKeys[0]);
    await assertLayout(16 / 9);
    await seekSync(pair.reference);
    await page.waitForFunction((time) => {
      const v = document.querySelector('#sync_angle_0 video');
      return (
        v &&
        v.readyState >= 2 &&
        !v.seeking &&
        Math.abs(v.currentTime - (time < 6 ? time : time - 6)) < 0.005
      );
    }, pair.reference);
    await timeline
      .getByRole('button', { name: '同期点を設定', exact: true })
      .click();
    await timeline.getByLabel('Angle 1の同期点', { exact: true }).waitFor();
    await timeline.keyboard.press(angleKeys[1]);
    await seekSync(pair.target);
    await page.waitForFunction((time) => {
      const v = document.querySelector('#sync_angle_1 video');
      return (
        v &&
        v.readyState >= 2 &&
        !v.seeking &&
        (time < 6 ? /C\.mp4$/ : /D\.mp4$/).test(v.currentSrc) &&
        Math.abs(v.currentTime - 1) < 0.005
      );
    }, pair.target);
    // The media frame can settle before its readiness reaches the detached Timeline.
    await timeline
      .getByRole('button', { name: '同期点を設定', exact: true })
      .click({ trial: true });
    await timeline.keyboard.press('s');
    await timeline.getByLabel('Angle 2の同期点', { exact: true }).waitFor();
    await timeline
      .getByRole('button', { name: 'アングルを同期', exact: true })
      .waitFor();
    await timeline
      .getByRole('button', { name: 'アングルを同期', exact: true })
      .click();
    await assertLayout(32 / 9);
    await timeline.getByRole('button', { name: '再生', exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('video')].every(
        (v) => !v.paused && v.currentTime > 1.2,
      ),
    );
    await timeline
      .getByRole('button', { name: '一時停止', exact: true })
      .click();
  }
  // Each angle steps actual decoded frames (25 fps and 50 fps), never a global 30 fps guess.
  for (const [angle, rate] of [
    [1, 25],
    [2, 50],
  ]) {
    await timeline.keyboard.press(angleKeys[angle - 1]);
    await seekSync(angle === 1 ? 9 : 9);
    await page.waitForFunction((index) => {
      const v = document.querySelector(`#sync_angle_${index} video`);
      return v.readyState >= 2 && !v.seeking;
    }, angle - 1);
    const before = await page
      .locator(`#sync_angle_${angle - 1} video`)
      .evaluate((v) => v.currentTime);
    await timeline
      .getByRole('button', { name: '1コマ進む', exact: true })
      .click();
    await page.waitForFunction(
      ({ index, before, rate }) =>
        Math.abs(
          document.querySelector(`#sync_angle_${index} video`).currentTime -
            before -
            1 / rate,
        ) < 0.001,
      { index: angle - 1, before, rate },
    );
    await timeline.keyboard.press('ArrowRight');
    await page.waitForFunction(
      ({ index, before, rate }) =>
        Math.abs(
          document.querySelector(`#sync_angle_${index} video`).currentTime -
            before -
            2 / rate,
        ) < 0.001,
      { index: angle - 1, before, rate },
    );
  }
  // Seeking the angle itself crosses source boundaries without a file picker.
  await seekSync(1.5);
  await page.waitForFunction(() =>
    /C\.mp4$/.test(document.querySelector('#sync_angle_1 video').currentSrc),
  );
  await seekSync(9);
  await page.waitForFunction(() =>
    /D\.mp4$/.test(document.querySelector('#sync_angle_1 video').currentSrc),
  );
  await timeline.keyboard.press(angleKeys[1]); // same angle key returns to all angles
  await assertLayout(32 / 9);
  await fs.mkdir('output/playwright', { recursive: true });
  await page.mouse.move(4, 4);
  await page.emulateMedia({ colorScheme: 'dark' });
  await timeline.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'output/playwright/angle-sync-workspace.png' });
  await timeline.screenshot({
    path: 'output/playwright/angle-sync-timeline.png',
  });
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(
      (item) => !item.webContents.getURL().includes('#/'),
    );
    const [, height] = window.getSize();
    window.setSize(920, height);
  });
  await assertLayout(32 / 9);
  await page.screenshot({
    path: 'output/playwright/angle-sync-workspace-compact.png',
  });
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().includes('#/timeline'),
    );
    window.setSize(720, 320);
  });
  await assertLayout(32 / 9);
  await timeline.screenshot({
    path: 'output/playwright/angle-sync-timeline-compact.png',
  });
  await timeline
    .getByRole('button', { name: '保存して閉じる', exact: true })
    .click();
  await page
    .getByLabel('アングル同期ワークスペース', { exact: true })
    .waitFor({ state: 'hidden' });
};
