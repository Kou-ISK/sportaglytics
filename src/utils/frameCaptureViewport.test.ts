/* @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import {
  withFrameCaptureViewport,
  waitForCapturePaint,
} from './frameCaptureViewport';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it.each([1, 1.25, 1.5, 2])(
  'aligns a fractional root and restores it at scale %s',
  async (scale) => {
    vi.stubGlobal('devicePixelRatio', scale);
    const root = document.createElement('div');
    document.body.append(root);
    const original = new DOMRect(12, 59.390625, 1416, 703.609375);
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('innerHeight', 775);
    const y = Math.ceil(original.top * scale) / scale;
    const height = Math.floor(original.bottom * scale) / scale - y;
    root.getBoundingClientRect = () =>
      root.style.width ? new DOMRect(12, y, 1416, height) : original;
    root.scrollTop = 400;
    const style = root.style.cssText;
    await withFrameCaptureViewport(root, async (viewport) => {
      expect(viewport.rect).toEqual({
        x: 12,
        y: y + 48 / scale,
        width: 1416,
        height: height - 48 / scale,
      });
      expect(parseFloat(root.style.paddingTop)).toBeCloseTo(48 / scale);
      root.scrollTop = 679;
      root.scrollLeft = 38;
      const proof = viewport.proof();
      const marker = root.querySelector<HTMLElement>('[data-capture-proof]');
      expect(marker?.children.length).toBe(100);
      expect(Number.parseFloat(marker?.style.top ?? '')).toBeCloseTo(
        679 + proof.marker.y - y,
      );
      expect(Number.parseFloat(marker?.style.left ?? '')).toBeCloseTo(
        38 + proof.marker.x - 12,
      );
      expect(proof.marker.y + proof.marker.height).toBeLessThan(
        viewport.rect.y,
      );
      expect(proof.nonce).toMatch(/^[a-f0-9]{16}$/);
      expect(viewport.proof().nonce).not.toBe(proof.nonce);
    });
    expect(root.style.cssText).toBe(style);
    expect(root.scrollTop).toBe(400);
    expect(root.scrollLeft).toBe(0);
    expect(root.children.length).toBe(0);
  },
);
it('rejects a viewport without room for the verification strip', async () => {
  const root = document.createElement('div');
  root.getBoundingClientRect = () => new DOMRect(0, 0, 200, 24);
  const capture = vi.fn();
  await expect(withFrameCaptureViewport(root, capture)).rejects.toThrow(
    'too small',
  );
  expect(root.style.cssText).toBe('');
  expect(root.children.length).toBe(0);
  expect(capture).not.toHaveBeenCalled();
});
it('bounds a missing paint callback instead of waiting forever', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 9),
  );
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const result = expect(waitForCapturePaint()).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(1000);
  await result;
  expect(cancel).toHaveBeenCalledWith(9);
});
