import assert from 'node:assert/strict';

/** Exercise the same command route used by the detached Timeline, using synthetic clips. */
export const exercisePlaybackInteractions = async (main, timeline) => {
  const head = timeline.getByRole('slider', { name: 'タイムラインの再生位置' });
  const axis = timeline.getByTestId('timeline-time-origin');
  const box = await axis.boundingBox();
  const target = 2;
  await timeline.evaluate(() => {
    const api = window.electronAPI.timelineWindow;
    const record = ({ currentTime }) => {
      window.__interactionClock = currentTime;
    };
    const offClock = api.onClock(record);
    const offSync = api.onSync(record);
    window.__stopInteractionClock = () => {
      offClock();
      offSync();
    };
  });
  const clipTrace = await main.evaluateHandle(() => {
    const entries = [],
      controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    const record = (kind, data) => {
      if (entries.length === 48) entries.shift();
      entries.push([Math.round(performance.now()), kind, data]);
    };
    // Observe callbacks the scrubber itself registers. Adding an independent
    // compositor callback could change frame delivery on a paused element.
    const originalFrameRequest =
      HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      return originalFrameRequest.call(this, (now, metadata) => {
        record('presented', [
          this.currentSrc.split('/').pop(),
          metadata.mediaTime,
          metadata.presentationTime,
          this.currentTime,
          this.seeking,
        ]);
        callback.call(this, now, metadata);
      });
    };
    for (const kind of [
      'loadstart',
      'loadedmetadata',
      'loadeddata',
      'seeking',
      'seeked',
      'error',
    ]) {
      document.addEventListener(
        kind,
        ({ target }) => {
          if (target instanceof HTMLVideoElement)
            record(kind, [
              target.currentSrc.split('/').pop(),
              target.currentTime,
              target.readyState,
            ]);
        },
        options,
      );
    }
    for (const kind of ['video-seek-start', 'video-seek-end'])
      window.addEventListener(
        kind,
        (event) => record(kind, event.detail),
        options,
      );
    return {
      entries,
      stop: () => {
        controller.abort();
        HTMLVideoElement.prototype.requestVideoFrameCallback =
          originalFrameRequest;
      },
    };
  });
  try {
    // A and C start at global times 0 and 1. Test the ruler while held,
    // not just its final thumb position, then confirm both decoded sources.
    for (const cancel of [false, true]) {
      const place = (t) => box.x + (box.width * t) / 14;
      const bothAt = (t) =>
        main.waitForFunction(
          (time) => {
            const v = [...document.querySelectorAll('video')];
            return [
              ['A.mp4', 0],
              ['C.mp4', 1],
            ].every(([file, start]) =>
              v.some(
                (el) =>
                  el.currentSrc.endsWith(file) &&
                  !el.seeking &&
                  Math.abs(el.currentTime - (time - start)) < 0.12,
              ),
            );
          },
          t,
          { timeout: 10000 },
        );
      await timeline.mouse.move(place(2), box.y + 8);
      await timeline.mouse.down();
      try {
        await timeline.mouse.move(place(3), box.y + 8, { steps: 5 });
        await bothAt(3);
        await timeline.mouse.move(place(4), box.y + 8, { steps: 5 });
        if (cancel) {
          await axis.dispatchEvent('pointercancel', { pointerId: 1 });
          await timeline.mouse.move(place(5), box.y + 8);
        }
      } finally {
        await timeline.mouse.up();
      }
      await bothAt(4);
      console.log(
        'Both angle clocks confirmed through ruler drag and ' +
          (cancel ? 'cancellation' : 'release'),
      );
    }
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
    // The detached ruler previews immediately. Require the owner's confirmed cut
    // before testing that a subsequent lane click leaves the clock unchanged.
    await timeline.waitForFunction(
      (time) => Math.abs(window.__interactionClock - time) < 0.02,
      target,
    );
    // The unit test covers this ordering deterministically in CI. A paused
    // native compositor may need more than 28 ms on some hosts; opt in to
    // require real submissions before these synthetic setter calls return.
    if (process.env.E2E_VERIFY_SLOW_REWIND_SETTER === '1') {
      const rulerClick = (t) =>
        timeline.mouse.click(box.x + (box.width * t) / 14, box.y + 8);
      const clockAt = (time) =>
        timeline.waitForFunction(
          (expected) => Math.abs(window.__interactionClock - expected) < 0.02,
          time,
        );
      await rulerClick(4);
      await clockAt(4);
      const injection = await main.evaluateHandle(() => {
        const proto = HTMLMediaElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(
          proto,
          'currentTime',
        );
        const assignments = [];
        const installed = new Set();
        if (!descriptor?.set) throw Error('missing native currentTime setter');
        Object.defineProperty(proto, 'currentTime', {
          ...descriptor,
          set(time) {
            const source = this.currentSrc.split('/').pop();
            const target =
              source === '01-A.mp4' ? 2 : source === '01-C.mp4' ? 1 : NaN;
            if (
              !this.paused ||
              installed.has(source) ||
              Math.abs(this.currentTime - (target + 2)) >= 0.01 ||
              !(Math.abs(time - target) < 0.01)
            ) {
              descriptor.set.call(this, time);
              return;
            }
            installed.add(source);
            const started = performance.now();
            descriptor.set.call(this, time);
            const assigned = performance.now();
            // The real pointer may land just before 2.000000s. These synthetic
            // aligned CFR fixtures are 25fps and 50fps respectively: require
            // the one specific frame containing the actual assigned clock.
            const assignedClock = this.currentTime;
            const fps = source === '01-A.mp4' ? 25 : 50;
            const expectedPts = Math.floor(assignedClock * fps) / fps;
            while (performance.now() - assigned < 28) {
              // Let the compositor submit its decoded image without pumping
              // JavaScript events or substituting callback metadata.
            }
            assignments.push({
              source,
              target,
              started,
              assigned,
              assignedClock,
              expectedPts,
              returned: performance.now(),
            });
          },
        });
        return {
          assignments,
          restore: () =>
            Object.defineProperty(proto, 'currentTime', descriptor),
        };
      });
      try {
        let clockError;
        await rulerClick(2);
        try {
          await clockAt(2);
        } catch (error) {
          clockError = error;
        }
        const assignments = await injection.evaluate(
          (value) => value.assignments,
        );
        const events = await clipTrace.evaluate((value) => value.entries);
        const submitted = assignments.map((item) => ({
          ...item,
          frame: events.find(
            ([, kind, data]) =>
              kind === 'presented' &&
              data[0] === item.source &&
              Math.abs(data[1] - item.expectedPts) <= 0.000001 &&
              data[2] > item.started &&
              data[2] < item.returned,
          )?.[2],
        }));
        console.log('Slow rewind setter proof', JSON.stringify(submitted));
        assert.equal(
          submitted.length,
          2,
          'both synthetic setters must be delayed',
        );
        assert.ok(
          submitted.every(({ frame }) => frame !== undefined),
          'both real target frames must be submitted during their own setter (host did not reproduce)',
        );
        if (clockError) throw clockError;
      } finally {
        await injection.evaluate((value) => value.restore());
        await injection.dispose();
      }
    }
  } catch (error) {
    console.error(
      'Multi-clip ruler failure',
      JSON.stringify({
        target,
        box,
        clock: await timeline.evaluate(() => window.__interactionClock),
        events: await clipTrace.evaluate((trace) => trace.entries),
      }),
    );
    throw error;
  } finally {
    await clipTrace.evaluate((trace) => trace.stop());
    await clipTrace.dispose();
  }
  await timeline.evaluate(() => window.__stopInteractionClock());
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
