/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureScrollableContent,
  computeScrollOffsets,
  stitchCapturedSlicesIntoParts,
} from './fullContentCapture';

import { scaleCaptureRect } from '../shared/analysis/frameCapture';

interface Pixels {
  width: number;
  height: number;
  values: number[];
}
const images = new Map<string, Pixels>();
const outputs: Pixels[] = [];

class PixelImage {
  width = 0;
  height = 0;
  values: number[] = [];
  onload: (() => void) | null = null;
  set src(value: string) {
    const pixels = images.get(value);
    if (!pixels) throw new Error('Unknown test image');
    Object.assign(this, pixels);
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  images.clear();
  outputs.length = 0;
  vi.stubGlobal('Image', PixelImage);
  // Test the real stitch loop against a small raster canvas, without native PNG I/O.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      const pixels: Pixels = {
        width: this.width,
        height: this.height,
        values: Array(this.width * this.height).fill(-1),
      };
      outputs.push(pixels);
      return {
        fillStyle: '',
        fillRect: () => {},
        drawImage: (image: PixelImage, left: number, top: number) => {
          for (let y = 0; y < image.height; y += 1) {
            for (let x = 0; x < image.width; x += 1) {
              const dx = left + x;
              const dy = top + y;
              if (
                dx >= 0 &&
                dx < pixels.width &&
                dy >= 0 &&
                dy < pixels.height
              ) {
                pixels.values[dy * pixels.width + dx] =
                  image.values[y * image.width + x];
              }
            }
          }
        },
        // Only the 2D methods used by the stitcher are implemented at this boundary.
      } as unknown as CanvasRenderingContext2D;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
    () => `data:image/png;base64,part-${outputs.length}`,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const marker = (x: number, y: number): number => y * 1000 + x;
const makeSlices = (scale: number) => {
  const slices = [];
  // The last viewport overlaps both the preceding row and column.
  for (const offsetTop of computeScrollOffsets(8, 3)) {
    for (const offsetLeft of computeScrollOffsets(7, 4)) {
      const width = Math.round(4 * scale);
      const height = Math.round(3 * scale);
      const dataUrl = `slice-${offsetLeft}-${offsetTop}`;
      images.set(dataUrl, {
        width,
        height,
        values: Array.from({ length: width * height }, (_, i) =>
          marker(
            Math.round(offsetLeft * scale) + (i % width),
            Math.round(offsetTop * scale) + Math.floor(i / width),
          ),
        ),
      });
      slices.push({
        offsetLeft,
        offsetTop,
        width: 4,
        height: 3,
        dataUrl,
        scale,
      });
    }
  }
  return slices;
};

describe('PNG stitch pixel coverage', () => {
  it.each([1, 1.25, 1.5, 2])(
    'keeps all original content after proof-strip capture at %sx',
    async (scale) => {
      vi.stubGlobal('devicePixelRatio', scale);
      const root = document.createElement('div');
      document.body.append(root);
      const original = new DOMRect(0, 5.375, 48, 78);
      const y = Math.ceil(original.top * scale) / scale;
      const alignedHeight = Math.floor(original.bottom * scale) / scale - y;
      root.getBoundingClientRect = () =>
        root.style.width ? new DOMRect(0, y, 48, alignedHeight) : original;
      let scrollTop = 0;
      let scrollLeft = 0;
      Object.defineProperties(root, {
        scrollTop: {
          get: () => scrollTop,
          set: (value: number) => {
            scrollTop = Math.max(
              0,
              Math.min(
                value,
                120 +
                  parseFloat(root.style.paddingTop || '0') -
                  (root.style.height ? alignedHeight : 78),
              ),
            );
          },
        },
        scrollLeft: {
          get: () => scrollLeft,
          set: (value: number) => {
            scrollLeft = Math.max(0, Math.min(value, 22));
          },
        },
        scrollHeight: {
          get: () => Math.round(120 + parseFloat(root.style.paddingTop || '0')),
        },
        clientHeight: {
          get: () => Math.round(root.style.height ? alignedHeight : 78),
        },
        scrollWidth: { value: 70 },
        clientWidth: { value: 48 },
      });
      root.scrollTop = 7;
      root.scrollLeft = 5;
      const slices = await captureScrollableContent(root, async (rect) => {
        expect(root.querySelector('[data-capture-proof]')).not.toBeNull();
        expect(rect.y).toBe(y + 48 / scale);
        expect(rect.height).toBe(alignedHeight - 48 / scale);
        const { width, height } = scaleCaptureRect(rect, scale);
        const left = Math.round(root.scrollLeft * scale);
        const top = Math.round(root.scrollTop * scale);
        const png = `native-${left}-${top}`;
        images.set(`data:image/png;base64,${png}`, {
          width,
          height,
          values: Array.from({ length: width * height }, (_, i) =>
            marker(left + (i % width), top + Math.floor(i / width)),
          ),
        });
        return { png, scale };
      });
      await stitchCapturedSlicesIntoParts(slices, 37);
      const width = Math.round(70 * scale);
      const height = Math.round(120 * scale);
      expect(outputs.reduce((sum, part) => sum + part.height, 0)).toBe(height);
      expect(outputs.flatMap((part) => part.values)).toEqual(
        Array.from({ length: width * height }, (_, i) =>
          marker(i % width, Math.floor(i / width)),
        ),
      );
      expect([root.scrollLeft, root.scrollTop]).toEqual([5, 7]);
      expect(root.querySelector('[data-capture-proof]')).toBeNull();
      expect(root.style.cssText).toBe('');
      root.remove();
    },
  );

  it.each([1, 1.25, 1.5, 2])(
    'preserves every pixel at %sx across overlapping tails and output parts',
    async (scale) => {
      const parts = await stitchCapturedSlicesIntoParts(makeSlices(scale), 5);
      const width = Math.round(7 * scale);
      const height = Math.round(8 * scale);
      expect(outputs.every((part) => part.width === width)).toBe(true);
      expect(outputs.reduce((sum, part) => sum + part.height, 0)).toBe(height);
      expect(parts).toHaveLength(Math.ceil(height / 5));
      expect(outputs.flatMap((part) => part.values)).toEqual(
        Array.from({ length: width * height }, (_, i) =>
          marker(i % width, Math.floor(i / width)),
        ),
      );
    },
  );

  it('fails instead of silently saving a missing canvas part', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(
      stitchCapturedSlicesIntoParts(makeSlices(2), 5),
    ).rejects.toThrow('Canvas context');
  });

  it('keeps the real 15000-pixel split boundary continuous at 2x', async () => {
    const slices = [0, 4000].map((offsetTop) => {
      const dataUrl = `long-${offsetTop}`;
      images.set(dataUrl, {
        width: 2,
        height: 10000,
        values: Array.from({ length: 20000 }, (_, i) =>
          marker(i % 2, offsetTop * 2 + Math.floor(i / 2)),
        ),
      });
      return {
        offsetLeft: 0,
        offsetTop,
        width: 1,
        height: 5000,
        dataUrl,
        scale: 2,
      };
    });
    await stitchCapturedSlicesIntoParts(slices);
    expect(outputs.map(({ height }) => height)).toEqual([15000, 3000]);
    expect(outputs.flatMap(({ values }) => values)).toEqual(
      Array.from({ length: 36000 }, (_, i) => marker(i % 2, Math.floor(i / 2))),
    );
  });

  it('rejects capture scale changes instead of mixing resolutions', async () => {
    const slices = makeSlices(2);
    images.set(slices[1].dataUrl, {
      width: 4,
      height: 3,
      values: Array(12).fill(0),
    });
    await expect(stitchCapturedSlicesIntoParts(slices)).rejects.toThrow(
      'Capture scale changed',
    );
  });
});
