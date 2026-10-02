import { EventEmitter } from 'node:events';
import type { NativeImage, Rectangle, WebContents } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FrameCaptureRequest } from '../../../src/shared/analysis/frameCapture';
import { capturePresentedFrame } from './presentedFrameCapture';
import { isCaptureRegionPayload } from './ipcPayloadGuards';

const makeRequest = (scale = 1): FrameCaptureRequest => ({
  x: 0,
  y: 48 / scale,
  width: 100,
  height: 40,
  proof: {
    nonce: '0123456789abcdef',
    marker: {
      x: 4 / scale,
      y: 4 / scale,
      width: 40 / scale,
      height: 40 / scale,
    },
    viewportWidth: 100,
    viewportHeight: 100,
  },
});
const request = makeRequest();

// Raster boundary double: no Electron/native PNG codec in these unit tests.
class RasterImage {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly bytes: Buffer,
  ) {}
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
  toBitmap(): Buffer {
    return this.bytes;
  }
  toPNG(): Buffer {
    return this.bytes;
  }
  crop(rect: Rectangle): RasterImage {
    const bytes = Buffer.alloc(rect.width * rect.height * 4);
    for (let y = 0; y < rect.height; y += 1)
      this.bytes.copy(
        bytes,
        y * rect.width * 4,
        ((y + rect.y) * this.width + rect.x) * 4,
        ((y + rect.y) * this.width + rect.x + rect.width) * 4,
      );
    return new RasterImage(rect.width, rect.height, bytes);
  }
}
const frame = (
  scale: number,
  nonce = request.proof.nonce,
  shift = 0,
  shiftY = 0,
  blur = false,
  measuredEdges = false,
): NativeImage => {
  const width = Math.round(100 * scale);
  const data = Buffer.alloc(width * width * 4, 77);
  const bits = Array.from(nonce, (d) =>
    parseInt(d, 16).toString(2).padStart(4, '0'),
  ).join('');
  for (let row = 0; row < 10; row += 1)
    for (let col = 0; col < 10; col += 1) {
      const white =
        col === 0 || row === 0 || col === 9 || row === 9
          ? (col + row) % 2 === 0
          : bits[(row - 1) * 8 + col - 1] === '1';
      const left = 4 + col * 4 + shift;
      const right = 8 + col * 4 + shift;
      const top = 4 + row * 4 + shiftY;
      const bottom = 8 + row * 4 + shiftY;
      for (let y = top; y < bottom; y += 1)
        for (let x = left; x < right; x += 1) {
          const index = (y * width + x) * 4;
          data.fill(white ? 255 : 0, index, index + 3);
          data[index + 3] = 255;
        }
    }
  if (blur) {
    // Separable 1-pixel edge filtering models non-pure transition colors while
    // preserving the 2x2 interior. It is a synthetic AA model, not a Mac capture.
    for (const direction of [1, width]) {
      const previous = Buffer.from(data);
      for (let y = 1; y < width - 1; y++)
        for (let x = 1; x < width - 1; x++) {
          const index = (y * width + x) * 4;
          for (let channel = 0; channel < 3; channel++)
            data[index + channel] = Math.round(
              0.2 * previous[index + channel - direction * 4] +
                0.6 * previous[index + channel] +
                0.2 * previous[index + channel + direction * 4],
            );
        }
    }
  }
  if (measuredEdges) {
    // Synthetic locator profile containing the observed DPR1 value 158. Eight
    // boundary samples cross mid-grey; this is not a copy of the native PNG.
    for (const cell of [2, 4, 6, 8])
      for (const line of [1, 2]) {
        const index =
          ((4 + cell * 4 - 1 + shiftY) * width + 4 + line + shift) * 4;
        data.fill(158, index, index + 3);
      }
  }
  // Only the image boundary methods used by the adapter are supplied.
  return new RasterImage(width, width, data) as unknown as NativeImage;
};
const host = () => {
  const emitter = new EventEmitter();
  let callback: ((image: NativeImage, rect: Rectangle) => void) | undefined;
  const value = Object.assign(emitter, {
    isDestroyed: vi.fn(() => false),
    beginFrameSubscription: vi.fn(
      (_dirty: boolean, listener: typeof callback) => {
        callback = listener;
      },
    ),
    endFrameSubscription: vi.fn(),
    invalidate: vi.fn(),
  });
  // Structural WebContents boundary double, no renderer process is created.
  return {
    value,
    contents: value as unknown as WebContents,
    emitFrame: (image: NativeImage) =>
      callback?.(image, { x: 0, y: 0, width: 100, height: 100 }),
  };
};
afterEach(() => vi.useRealTimers());

describe('verified presentation capture', () => {
  it.each([1, 1.25, 1.5, 2])(
    'accepts only the matching frame at scale %s',
    async (scale) => {
      const h = host();
      const result = capturePresentedFrame(
        h.contents,
        makeRequest(scale),
        scale,
      );
      h.emitFrame(frame(scale, 'ffffffffffffffff'));
      for (const shift of [-1, 1]) {
        h.emitFrame(frame(scale, request.proof.nonce, shift));
        h.emitFrame(frame(scale, request.proof.nonce, 0, shift));
      }
      expect(h.value.endFrameSubscription).not.toHaveBeenCalled();
      h.emitFrame(frame(scale));
      const captured = await result;
      expect(captured?.scale).toBe(scale);
      expect(Buffer.from(captured?.png ?? '', 'base64')).toEqual(
        Buffer.alloc(Math.round(100 * scale) * Math.round(40 * scale) * 4, 77),
      );
      expect(h.value.endFrameSubscription).toHaveBeenCalledOnce();
      expect(h.value.eventNames()).toEqual([]);
      h.emitFrame(frame(scale));
      expect(h.value.endFrameSubscription).toHaveBeenCalledOnce();
    },
  );
  it.each([1, 1.25, 1.5, 2])(
    'accepts AA boundaries but rejects stale/shifted proof at scale %s',
    async (scale) => {
      const h = host();
      const result = capturePresentedFrame(
        h.contents,
        makeRequest(scale),
        scale,
      );
      h.emitFrame(frame(scale, 'ffffffffffffffff', 0, 0, true));
      h.emitFrame(frame(scale, '1123456789abcdef', 0, 0, true));
      // The same nonce at another scroll must not pass solely on cell interiors.
      for (const shift of [-2, -1, 1, 2, 4, 8]) {
        h.emitFrame(frame(scale, request.proof.nonce, shift, 0, true));
        h.emitFrame(frame(scale, request.proof.nonce, 0, shift, true));
      }
      expect(h.value.endFrameSubscription).not.toHaveBeenCalled();
      h.emitFrame(frame(scale, request.proof.nonce, 0, 0, true));
      expect(await result).not.toBeNull();
      expect(h.value.endFrameSubscription).toHaveBeenCalledOnce();
      expect(h.value.eventNames()).toEqual([]);
    },
  );

  it.each([1, 1.25, 1.5, 2])(
    'accepts the measured 158 edge profile only at its original position (%sx)',
    async (scale) => {
      const h = host();
      const result = capturePresentedFrame(
        h.contents,
        makeRequest(scale),
        scale,
      );
      h.emitFrame(frame(scale, '1123456789abcdef', 0, 0, true, true));
      for (const shift of [-1, 1]) {
        h.emitFrame(frame(scale, request.proof.nonce, shift, 0, true, true));
        h.emitFrame(frame(scale, request.proof.nonce, 0, shift, true, true));
      }
      expect(h.value.endFrameSubscription).not.toHaveBeenCalled();
      h.emitFrame(frame(scale, request.proof.nonce, 0, 0, true, true));
      expect(await result).not.toBeNull();
      expect(h.value.endFrameSubscription).toHaveBeenCalledOnce();
      expect(h.value.eventNames()).toEqual([]);
    },
  );

  it('rejects an ambiguous half-pixel locator instead of choosing its requested position', async () => {
    const h = host();
    const result = capturePresentedFrame(h.contents, request, 1);
    const ambiguous = frame(1);
    // Mutate the raster boundary double: 0 and +1 have exactly equal error.
    const bytes = ambiguous.toBitmap();
    for (let cell = 1; cell < 10; cell++)
      for (const line of [1, 2]) {
        const index = ((4 + line) * 100 + 4 + cell * 4) * 4;
        bytes.fill(line === 1 ? 127 : 128, index, index + 3);
      }
    h.emitFrame(ambiguous);
    expect(h.value.endFrameSubscription).not.toHaveBeenCalled();
    h.emitFrame(frame(1));
    expect(await result).not.toBeNull();
  });

  it('times out without saving an old frame and releases the slot', async () => {
    vi.useFakeTimers();
    const h = host();
    const result = capturePresentedFrame(h.contents, request, 1);
    h.emitFrame(frame(1, 'ffffffffffffffff'));
    expect(await capturePresentedFrame(h.contents, request, 1)).toBeNull();
    await vi.advanceTimersByTimeAsync(2500);
    expect(await result).toBeNull();
    expect(h.value.eventNames()).toEqual([]);
    const next = capturePresentedFrame(h.contents, request, 1);
    h.emitFrame(frame(1));
    expect(await next).not.toBeNull();
  });
  it.each(['destroyed', 'render-process-gone', 'did-start-navigation'])(
    'cleans up on %s',
    async (event) => {
      const h = host();
      const result = capturePresentedFrame(h.contents, request, 1);
      if (event === 'destroyed') h.value.isDestroyed.mockReturnValue(true);
      h.value.emit(event);
      expect(await result).toBeNull();
      expect(h.value.eventNames()).toEqual([]);
      expect(h.value.endFrameSubscription).toHaveBeenCalledTimes(
        event === 'destroyed' ? 0 : 1,
      );
    },
  );
  it('validates the narrow proof payload', () => {
    expect(isCaptureRegionPayload(request)).toBe(true);
    expect(isCaptureRegionPayload({ ...request, proof: undefined })).toBe(
      false,
    );
    expect(
      isCaptureRegionPayload({
        ...request,
        proof: { ...request.proof, nonce: 'javascript' },
      }),
    ).toBe(false);
    expect(isCaptureRegionPayload({ ...request, y: 0 })).toBe(false);
    expect(isCaptureRegionPayload({ ...request, width: 200 })).toBe(false);
  });
});
