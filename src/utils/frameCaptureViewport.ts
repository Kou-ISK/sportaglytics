import {
  CAPTURE_MARKER_SIZE,
  CAPTURE_STRIP_HEIGHT,
  captureMarkerIsWhite,
  scaleCaptureRect,
  type CaptureRect,
  type FrameCaptureRequest,
} from '../shared/analysis/frameCapture';

export const waitForCapturePaint = (): Promise<void> =>
  new Promise((resolve, reject) => {
    let frame = 0;
    const timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      reject(new Error('Capture paint timed out'));
    }, 1000);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  });

interface CaptureViewport {
  rect: CaptureRect;
  proof: () => FrameCaptureRequest['proof'];
}

export const withFrameCaptureViewport = async <T>(
  container: HTMLElement,
  fn: (viewport: CaptureViewport) => Promise<T>,
): Promise<T> => {
  const previousStyle = container.style.cssText;
  const previousScroll = {
    left: container.scrollLeft,
    top: container.scrollTop,
  };
  const marker = document.createElement('div');
  marker.setAttribute('aria-hidden', 'true');
  marker.dataset.captureProof = '';
  const bounds = container.getBoundingClientRect();
  // Align the crop origin AND extent to native pixels. CSS-integer alignment
  // still leaves a half-pixel phase at fractional display/zoom scales.
  const scale = devicePixelRatio;
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error('Invalid capture scale');
  const x = Math.ceil(bounds.left * scale) / scale;
  const y = Math.ceil(bounds.top * scale) / scale;
  const width = Math.floor(bounds.right * scale) / scale - x;
  const height = Math.floor(bounds.bottom * scale) / scale - y;
  const stripHeight = Math.ceil(CAPTURE_STRIP_HEIGHT * scale) / scale;
  if (x < 0 || y < 0 || x + width > innerWidth || y + height > innerHeight)
    throw new Error('Capture viewport is outside the window');
  if (width < CAPTURE_MARKER_SIZE + 4 || height <= stripHeight)
    throw new Error('Capture viewport is too small');
  try {
    Object.assign(container.style, {
      position: 'relative',
      translate: `${x - bounds.left}px ${y - bounds.top}px`,
      boxSizing: 'border-box',
      width: `${width}px`,
      height: `${height}px`,
      flex: 'none',
      minWidth: '0',
      minHeight: '0',
      maxWidth: 'none',
      maxHeight: 'none',
      overflow: 'hidden',
      scrollbarWidth: 'none',
      scrollbarGutter: 'auto',
      scrollBehavior: 'auto',
      scrollSnapType: 'none',
      overflowAnchor: 'none',
      paddingTop: `${(parseFloat(getComputedStyle(container).paddingTop) || 0) + stripHeight}px`,
    });
    marker.style.cssText =
      'position:absolute;pointer-events:none;contain:strict;';
    container.append(marker);
    await waitForCapturePaint();
    const aligned = container.getBoundingClientRect();
    const actualPixels = scaleCaptureRect(aligned, scale);
    const intendedPixels = scaleCaptureRect({ x, y, width, height }, scale);
    if (
      actualPixels.x !== intendedPixels.x ||
      actualPixels.y !== intendedPixels.y ||
      actualPixels.width !== intendedPixels.width ||
      actualPixels.height !== intendedPixels.height ||
      Math.abs(aligned.x - x) > 0.02 ||
      Math.abs(aligned.y - y) > 0.02 ||
      Math.abs(aligned.width - width) > 0.02 ||
      Math.abs(aligned.height - height) > 0.02
    )
      throw new Error('Capture viewport could not be aligned');
    const markerX = Math.round((x + 2) * scale) / scale;
    const markerY = Math.round((y + 2) * scale) / scale;
    const markerRect = {
      x: markerX,
      y: markerY,
      width: Math.round(CAPTURE_MARKER_SIZE * scale) / scale,
      height: Math.round(CAPTURE_MARKER_SIZE * scale) / scale,
    };
    return await fn({
      rect: {
        x,
        y: y + stripHeight,
        width,
        height: height - stripHeight,
      },
      proof: () => {
        const nonce = Array.from(
          crypto.getRandomValues(new Uint8Array(8)),
          (value) => value.toString(16).padStart(2, '0'),
        ).join('');
        marker.replaceChildren();
        Object.assign(marker.style, {
          left: `${container.scrollLeft + markerX - x}px`,
          top: `${container.scrollTop + markerY - y}px`,
          width: `${markerRect.width}px`,
          height: `${markerRect.width}px`,
        });
        for (let row = 0; row < 10; row += 1)
          for (let col = 0; col < 10; col += 1) {
            const cell = document.createElement('div');
            const left = Math.round(col * 2 * scale) / scale;
            const top = Math.round(row * 2 * scale) / scale;
            // These black/white cells are a machine-read capture proof, not UI chrome.
            Object.assign(cell.style, {
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${Math.round((col + 1) * 2 * scale) / scale - left}px`,
              height: `${Math.round((row + 1) * 2 * scale) / scale - top}px`,
              backgroundColor: captureMarkerIsWhite(nonce, col, row)
                ? '#ffffff'
                : '#000000',
            });
            marker.append(cell);
          }
        return {
          nonce,
          marker: markerRect,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      },
    });
  } finally {
    marker.remove();
    container.style.cssText = previousStyle;
    container.scrollLeft = previousScroll.left;
    container.scrollTop = previousScroll.top;
  }
};
