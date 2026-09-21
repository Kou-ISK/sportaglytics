import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

/** Uses the real detached code window, common seek command and persisted timeline. */
export const exerciseMultiClipCoding = async (
  app,
  main,
  timeline,
  timelinePath,
) => {
  await main.evaluate(() => window.electronAPI.codingPanelWindow.openWindow());
  let panel;
  for (let attempt = 0; attempt < 100; attempt++) {
    panel = app.windows().find((page) => page.url().includes('#/coding-panel'));
    if (panel) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(panel, 'detached coding panel opens');
  await panel.getByRole('button', { name: 'コード', exact: true }).waitFor();
  await panel.evaluate(() => {
    window.electronAPI.codingPanelWindow.sendCommand({
      type: 'layout-updated',
      layout: {
        id: 'coding-clock',
        name: 'Coding clock',
        canvasWidth: 400,
        canvasHeight: 200,
        buttons: [
          {
            id: 'record',
            type: 'action',
            name: 'Recorded',
            x: 20,
            y: 20,
            width: 140,
            height: 60,
            hotkey: 'Q',
          },
          {
            id: 'secondary',
            type: 'action',
            name: 'Secondary',
            x: 200,
            y: 20,
            width: 140,
            height: 60,
          },
        ],
        buttonLinks: [
          {
            id: 'stop-secondary',
            fromButtonId: 'record',
            toButtonId: 'secondary',
            type: 'deactivate',
          },
        ],
      },
    });
    window.electronAPI.codingPanelWindow.sendCommand({
      type: 'set-mode',
      mode: 'code',
    });
  });
  const button = panel.locator('[data-code-window-button="record"]');
  await button.waitFor();
  const seek = async (time) => {
    await timeline.evaluate(
      (target) =>
        new Promise((resolve, reject) => {
          const api = window.electronAPI.timelineWindow;
          const timer = setTimeout(() => {
            off();
            reject(new Error('Common clock did not seek'));
          }, 10000);
          const off = api.onClock((clock) => {
            if (Math.abs(clock.currentTime - target) > 0.01) return;
            clearTimeout(timer);
            off();
            resolve();
          });
          api.sendCommand({ type: 'seek', time: target });
        }),
      time,
    );
    await main.waitForFunction((target) => {
      const video = document.querySelector('#video_0 video');
      if (target >= 12) return !video;
      const expectedSource = target < 6 ? 'A.mp4' : 'B.mp4';
      return (
        video?.currentSrc.endsWith(expectedSource) &&
        !video.seeking &&
        video.readyState >= 2 &&
        Math.abs(video.currentTime - (target < 6 ? target : target - 6)) < 0.12
      );
    }, time);
  };
  const toggle = async (keyboard, active) => {
    await panel.bringToFront();
    if (keyboard) await panel.keyboard.press('q');
    else await button.click();
    // MUI removes icon test IDs in production builds; this is the recording dot.
    await button.locator('svg').waitFor({
      state: active ? 'visible' : 'detached',
    });
  };
  try {
    for (const [start, end, keyboard] of [
      [1, 2, false], // First source remains unchanged.
      [4.5, 7.5, false], // Recording crosses A -> B, whose source clock restarts.
      [8, 9.5, false], // Both endpoints in the second source.
      [10, 11, true], // Configured coding hotkey in the detached window.
      [12.5, 13.5, false], // Angle 1 has ended, but angle 2 still has footage.
    ]) {
      const before = JSON.parse(await fs.readFile(timelinePath, 'utf8'))
        .instances.length;
      await seek(start);
      console.log(`Coding interval ${start}-${end}: start`);
      await toggle(keyboard, true);
      await seek(end);
      await toggle(keyboard, false);
      let document;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          document = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
          if (document.instances.length > before) break;
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(
        document.instances.length,
        before + 1,
        'one persisted instance per completed recording',
      );
      const recorded = document.instances.at(-1);
      assert.equal(recorded.actionName, 'Recorded');
      assert.ok(
        Math.abs(recorded.startTime - start) < 0.02,
        `recorded start must use package clock: expected ${start}, received ${recorded.startTime}`,
      );
      assert.ok(
        Math.abs(recorded.endTime - end) < 0.02,
        `recorded end must use package clock: expected ${end}, received ${recorded.endTime}`,
      );
      await timeline.getByTestId(`timeline-instance-${recorded.id}`).waitFor();
    }
    console.log(
      'Cross-clip, second-half, hotkey and missing-primary coding persisted on the common Timeline',
    );
    const secondary = panel.locator('[data-code-window-button="secondary"]');
    await seek(8);
    await secondary.click();
    await secondary.locator('svg').waitFor();
    await seek(9);
    await toggle(false, true);
    await secondary.locator('svg').waitFor({ state: 'detached' });
    await seek(9.5);
    await secondary.click();
    await secondary.locator('svg').waitFor();
    await seek(10);
    await toggle(false, false);
    assert.equal(
      await secondary.locator('svg').count(),
      1,
      'stopping the source must leave the reactivated target recording',
    );
    await seek(11);
    await secondary.click();
    await secondary.locator('svg').waitFor({ state: 'detached' });
    let linkedIntervals;
    for (let attempt = 0; attempt < 100; attempt++) {
      linkedIntervals = JSON.parse(
        await fs.readFile(timelinePath, 'utf8'),
      ).instances.filter((instance) => instance.actionName === 'Secondary');
      if (linkedIntervals.length === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.deepEqual(
      linkedIntervals.map(({ startTime, endTime }) => [startTime, endTime]),
      [
        [8, 9],
        [9.5, 11],
      ],
      'deactivate links fire only on source activation',
    );
    console.log('Detached Code Window deactivate link activation edge passed');
  } finally {
    // Invoke from the owner so the closing panel cannot destroy the reply context.
    await main.evaluate(() =>
      window.electronAPI.codingPanelWindow.closeWindow(),
    );
  }
};
