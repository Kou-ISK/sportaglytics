import { EventEmitter } from 'node:events';
import type { NativeImage, Rectangle, WebContents } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FrameCaptureRequest } from '../../../src/shared/analysis/frameCapture';
import { capturePresentedFrame } from './presentedFrameCapture';
import { isCaptureRegionPayload } from './ipcPayloadGuards';

const request: FrameCaptureRequest = {
  x: 0,
  y: 24,
  width: 100,
  height: 60,
  proof: {
    nonce: '0123456789abcdef',
    marker: { x: 4, y: 2, width: 20, height: 20 },
    viewportWidth: 100,
    viewportHeight: 100,
  },
};

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
      const left = Math.round((4 + col * 2) * scale) + shift;
      const right = Math.round((6 + col * 2) * scale) + shift;
      const top = Math.round((2 + row * 2) * scale);
      const bottom = Math.round((4 + row * 2) * scale);
      for (let y = top; y < bottom; y += 1)
        for (let x = left; x < right; x += 1) {
          const index = (y * width + x) * 4;
          data.fill(white ? 255 : 0, index, index + 3);
          data[index + 3] = 255;
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
      const result = capturePresentedFrame(h.contents, request, scale);
      h.emitFrame(frame(scale, 'ffffffffffffffff'));
      h.emitFrame(frame(scale, request.proof.nonce, 1));
      expect(h.value.endFrameSubscription).not.toHaveBeenCalled();
      h.emitFrame(frame(scale));
      const captured = await result;
      expect(captured?.scale).toBe(scale);
      expect(Buffer.from(captured?.png ?? '', 'base64')).toEqual(
        Buffer.alloc(
          Math.round(100 * scale) *
            (Math.round(84 * scale) - Math.round(24 * scale)) *
            4,
          77,
        ),
      );
      expect(h.value.endFrameSubscription).toHaveBeenCalledOnce();
      expect(h.value.eventNames()).toEqual([]);
      h.emitFrame(frame(scale));
      expect(h.value.endFrameSubscription).toHaveBeenCalledOnce();
    },
  );
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
