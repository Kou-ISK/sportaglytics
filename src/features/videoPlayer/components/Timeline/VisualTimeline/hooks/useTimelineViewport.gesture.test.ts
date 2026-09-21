/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelineViewport } from './useTimelineViewport';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setupViewport = () => {
  const element = document.createElement('div');
  let scrollLeft = 0;
  let viewport: ReturnType<typeof useTimelineViewport> | undefined;
  Object.defineProperties(element, {
    clientWidth: { value: 1006 },
    scrollWidth: { get: () => 120 + (viewport?.timeToPosition(14) ?? 886) },
    // A scale-factor-1 Chromium viewport quantizes scrolling to whole pixels.
    scrollLeft: {
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = Math.round(value);
      },
    },
  });
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(9, 0, 1006, 200),
  );
  const hook = renderHook(() => {
    viewport = useTimelineViewport({ maxSec: 14, currentTime: 0 });
    viewport.scrollContainerRef.current = element;
    return viewport;
  });
  const zoom = (deltaY = -100, clientX = 483): void => {
    act(() => {
      element.dispatchEvent(
        new WheelEvent('wheel', {
          ctrlKey: true,
          deltaY,
          clientX,
          cancelable: true,
        }),
      );
    });
  };
  return { element, hook, zoom };
};

describe('timeline pinch anchor', () => {
  it('does not amplify rounded scroll positions during consecutive zoom events', () => {
    const { element, hook, zoom } = setupViewport();
    const anchorTime = (354 / 886) * 14;
    for (let step = 0; step < 3; step++) {
      zoom();
      const position =
        9 +
        120 +
        hook.result.current.timeToPosition(anchorTime) -
        element.scrollLeft;
      expect(Math.abs(position - 483)).toBeLessThanOrEqual(0.51);
    }
    expect(hook.result.current.zoomScale).toBeGreaterThan(10);
  });

  it('captures a new anchor after a user scroll', () => {
    const { element, hook, zoom } = setupViewport();
    zoom();
    element.scrollLeft += 180;
    const anchorTime = hook.result.current.positionToTime(
      element.scrollLeft + 354,
    );
    zoom();
    const position =
      9 +
      120 +
      hook.result.current.timeToPosition(anchorTime) -
      element.scrollLeft;
    expect(Math.abs(position - 483)).toBeLessThanOrEqual(0.51);
  });

  it('captures the visible time when the pointer moves', () => {
    const { element, hook, zoom } = setupViewport();
    zoom();
    const anchorTime = hook.result.current.positionToTime(
      element.scrollLeft + 400,
    );
    zoom(-100, 529);
    const position =
      9 +
      120 +
      hook.result.current.timeToPosition(anchorTime) -
      element.scrollLeft;
    expect(Math.abs(position - 529)).toBeLessThanOrEqual(0.51);
  });

  it('reanchors after zooming out against a scroll boundary', () => {
    const { element, hook, zoom } = setupViewport();
    zoom();
    element.scrollLeft = 0;
    zoom(120);
    expect(hook.result.current.zoomScale).toBe(1);
    const anchorTime = hook.result.current.positionToTime(354);
    zoom();
    const position =
      9 +
      120 +
      hook.result.current.timeToPosition(anchorTime) -
      element.scrollLeft;
    expect(Math.abs(position - 483)).toBeLessThanOrEqual(0.51);
  });
});
