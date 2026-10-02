import type { NativeImage, WebContents } from 'electron';
import {
  CAPTURE_MARKER_SIZE,
  captureMarkerIsWhite,
  scaleCaptureRect,
  type FrameCaptureRequest,
  type FrameCaptureResult,
} from '../../../src/shared/analysis/frameCapture';

const activeCaptures = new WeakSet<WebContents>();

const matchesProof = (
  image: NativeImage,
  request: FrameCaptureRequest,
  scale: number,
): boolean => {
  const size = image.getSize();
  const { proof } = request;
  const markerSize = Math.round(CAPTURE_MARKER_SIZE * scale) / scale;
  if (
    Math.abs(proof.marker.width - markerSize) > 0.000001 ||
    Math.abs(proof.marker.height - markerSize) > 0.000001 ||
    Math.abs(size.width - proof.viewportWidth * scale) > 1 ||
    Math.abs(size.height - proof.viewportHeight * scale) > 1
  )
    return false;
  const marker = scaleCaptureRect(proof.marker, scale);
  if (
    marker.x < 0 ||
    marker.y < 0 ||
    marker.x + marker.width > size.width ||
    marker.y + marker.height > size.height
  )
    return false;
  const pixels = image.crop(marker).toBitmap();
  // Check every interior pixel of every cell, including the locator border.
  // Centre-only checks can accept a marker shifted by one native pixel.
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const cell = scaleCaptureRect(
        {
          x: proof.marker.x + col * 2,
          y: proof.marker.y + row * 2,
          width: 2,
          height: 2,
        },
        scale,
      );
      const white = captureMarkerIsWhite(proof.nonce, col, row);
      for (let y = cell.y; y < cell.y + cell.height; y += 1) {
        for (let x = cell.x; x < cell.x + cell.width; x += 1) {
          const index = ((y - marker.y) * marker.width + x - marker.x) * 4;
          if (pixels[index + 3] !== 255) return false;
          for (let channel = 0; channel < 3; channel += 1) {
            const value = pixels[index + channel];
            if (white ? value < 224 : value > 31) return false;
          }
        }
      }
    }
  }
  return true;
};

/** Accept only the supplied presentation image carrying this scroll's proof. */
export const capturePresentedFrame = (
  contents: WebContents,
  request: FrameCaptureRequest,
  scale: number,
): Promise<FrameCaptureResult | null> => {
  if (contents.isDestroyed() || activeCaptures.has(contents))
    return Promise.resolve(null);
  activeCaptures.add(contents);
  return new Promise((resolve) => {
    let settled = false;
    let subscribed = false;
    const finish = (result: FrameCaptureResult | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      contents.removeListener('destroyed', cancel);
      contents.removeListener('render-process-gone', cancel);
      contents.removeListener('did-start-navigation', cancel);
      if (subscribed && !contents.isDestroyed()) {
        try {
          contents.endFrameSubscription();
        } catch {
          /* Renderer teardown already releases its subscriber. */
        }
      }
      activeCaptures.delete(contents);
      resolve(result);
    };
    const cancel = (): void => finish(null);
    // A failure deadline, never a success delay or an unverified fallback.
    const timer = setTimeout(cancel, 2500);
    contents.once('destroyed', cancel);
    contents.once('render-process-gone', cancel);
    contents.once('did-start-navigation', cancel);
    try {
      subscribed = true;
      contents.beginFrameSubscription(false, (image) => {
        if (settled) return;
        try {
          if (!matchesProof(image, request, scale)) return;
          const rect = scaleCaptureRect(request, scale);
          const size = image.getSize();
          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            rect.x < 0 ||
            rect.y < 0 ||
            rect.x + rect.width > size.width ||
            rect.y + rect.height > size.height
          )
            return finish(null);
          const png = image.crop(rect).toPNG().toString('base64');
          finish({ png, scale });
        } catch {
          finish(null);
        }
      });
      if (!settled) contents.invalidate();
    } catch {
      finish(null);
    }
  });
};
