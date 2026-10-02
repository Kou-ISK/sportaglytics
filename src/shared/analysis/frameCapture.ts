/** Internal, purpose-specific contract for analysis PNG capture. */
export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CAPTURE_CELL_PIXELS = 4;
export const CAPTURE_MARKER_PIXELS = CAPTURE_CELL_PIXELS * 10;
export const CAPTURE_STRIP_PIXELS = CAPTURE_MARKER_PIXELS + 8;

export interface FrameCaptureRequest extends CaptureRect {
  proof: {
    nonce: string;
    marker: CaptureRect;
    viewportWidth: number;
    viewportHeight: number;
  };
}

export interface FrameCaptureResult {
  png: string;
  scale: number;
}

/** Opaque cells on the native pixel grid, with an alternating border to verify location. */
export const captureMarkerIsWhite = (
  nonce: string,
  column: number,
  row: number,
): boolean => {
  if (column === 0 || row === 0 || column === 9 || row === 9) {
    return (column + row) % 2 === 0;
  }
  const bit = (row - 1) * 8 + column - 1;
  return (
    (parseInt(nonce[Math.floor(bit / 4)], 16) & (1 << (3 - (bit % 4)))) !== 0
  );
};

export const scaleCaptureRect = (
  rect: CaptureRect,
  scale: number,
): CaptureRect => {
  const x = Math.round(rect.x * scale);
  const y = Math.round(rect.y * scale);
  return {
    x,
    y,
    width: Math.round((rect.x + rect.width) * scale) - x,
    height: Math.round((rect.y + rect.height) * scale) - y,
  };
};
