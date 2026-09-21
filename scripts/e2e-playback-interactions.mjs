import assert from 'node:assert/strict';

/** Exercise the same command route used by the detached Timeline, using synthetic clips. */
export const exercisePlaybackInteractions = async (main, timeline) => {
  const head = timeline.getByRole('slider', { name: 'タイムラインの再生位置' });
  const axis = timeline.getByTestId('timeline-time-origin');
  const box = await axis.boundingBox();
  const target = 2;
  await timeline.mouse.click(box.x + (box.width * target) / 14, box.y + 8);
  await timeline.waitForFunction(
    () =>
      Math.abs(
        Number(
          document
            .querySelector('[aria-label="タイムラインの再生位置"]')
            .getAttribute('aria-valuenow'),
        ) - 2,
      ) < 0.02,
  );
  await timeline
    .getByTestId('timeline-lane-Attack')
    .click({ position: { x: 5, y: 20 } });
  assert.ok(
    Math.abs(Number(await head.getAttribute('aria-valuenow')) - target) < 0.02,
    'row clicks must not seek',
  );

  const anchorX = Math.round(box.x + box.width * 0.4);
  const anchorFraction = (anchorX - box.x) / box.width;
  for (let i = 1; i <= 3; i++) {
    await axis.dispatchEvent('wheel', {
      ctrlKey: true,
      deltaY: -100,
      clientX: anchorX,
      bubbles: true,
      cancelable: true,
    });
    await timeline.waitForFunction(
      ({ width, factor }) =>
        document
          .querySelector('[data-testid="timeline-time-origin"]')
          .getBoundingClientRect().width >
        width * factor,
      { width: box.width, factor: Math.exp(i) - 0.05 },
    );
  }
  const zoomed = await axis.boundingBox();
  assert.ok(
    zoomed.width > box.width * 10,
    'pinch exceeds the former 10x limit',
  );
  assert.ok(
    Math.abs(zoomed.x + zoomed.width * anchorFraction - anchorX) < 2,
    `pinch keeps the time under the pointer: ${JSON.stringify({ box, zoomed, anchorX })}`,
  );
  for (let i = 0; i < 4; i++) {
    await axis.dispatchEvent('wheel', {
      ctrlKey: true,
      deltaY: 120,
      clientX: anchorX,
      bubbles: true,
      cancelable: true,
    });
    await timeline.waitForTimeout(30);
  }
  await timeline.waitForFunction(
    (width) =>
      Math.abs(
        document
          .querySelector('[data-testid="timeline-time-origin"]')
          .getBoundingClientRect().width - width,
      ) < 1,
    box.width,
  );

  await timeline.evaluate(() => {
    document.activeElement?.blur();
    window.electronAPI.timelineWindow.sendCommand({ type: 'seek', time: 2 });
  });
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => !v.seeking && v.readyState >= 2,
    ),
  );
  await timeline.keyboard.down('ArrowRight');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => !v.paused && v.playbackRate === 0.5,
    ),
  );
  await timeline.waitForTimeout(250);
  await timeline.keyboard.up('ArrowRight');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => v.paused && !v.seeking,
    ),
  );
  const stopped = Number(await head.getAttribute('aria-valuenow'));
  await timeline.waitForTimeout(200);
  assert.ok(
    Math.abs(Number(await head.getAttribute('aria-valuenow')) - stopped) < 0.03,
    'releasing Right preserves paused playback',
  );

  await main.evaluate(() => {
    window.__playbackSeeks = 0;
    document.addEventListener(
      'seeking',
      () => {
        window.__playbackSeeks++;
      },
      true,
    );
  });
  await timeline.keyboard.press('Space');
  await timeline.keyboard.down('Alt');
  await timeline.keyboard.down('ArrowRight');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => !v.paused && v.playbackRate === 6,
    ),
  );
  await main.waitForFunction(
    () =>
      [...document.querySelectorAll('video')].some(
        (v) => v.currentSrc.endsWith('B.mp4') && v.currentTime > 0.2,
      ),
    undefined,
    { timeout: 4000 },
  );
  await timeline.keyboard.up('ArrowRight');
  await timeline.keyboard.up('Alt');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => !v.paused && v.playbackRate === 1,
    ),
  );
  await timeline.keyboard.press('Space');
  await main.waitForFunction(() =>
    [...document.querySelectorAll('video')].every(
      (v) => v.paused && !v.seeking,
    ),
  );
  const seeks = await main.evaluate(() => window.__playbackSeeks);
  assert.ok(
    seeks <= 12,
    `fast-forward should not issue per-frame seeks (${seeks})`,
  );
  console.log(
    `Ruler-only seeking, anchored pinch, paused key release and 6x source crossing passed (${seeks} seeks)`,
  );
};
