export const MIN_ZOOM_SCALE = 1;
export const MAX_ZOOM_SCALE = 100;
export const clampZoomScale = (value: number): number =>
  Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, value));

export const wheelZoomFactor = (delta: number, mode: number): number => {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? 800 : 1);
  return Math.exp(-Math.max(-120, Math.min(120, pixels)) * 0.01);
};

export const calculateAnchoredScrollLeft = ({
  anchorTime,
  viewportWidth,
  scrollWidth,
  timeToPosition,
  anchorViewportX = viewportWidth / 2,
  headerWidth = 0,
}: {
  anchorTime: number;
  viewportWidth: number;
  scrollWidth: number;
  timeToPosition: (time: number) => number;
  anchorViewportX?: number;
  headerWidth?: number;
}): number =>
  Math.max(
    0,
    Math.min(
      Math.max(0, scrollWidth - viewportWidth),
      headerWidth + timeToPosition(anchorTime) - anchorViewportX,
    ),
  );

/** Only render visible ticks, even at 100x on a long match. */
export const visibleTimeMarkers = (
  duration: number,
  width: number,
  zoom: number,
  scrollLeft: number,
): number[] => {
  if (duration <= 0 || width <= 0) return [];
  const pixelsPerSecond = (width * zoom) / duration;
  const interval =
    [
      0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200,
      14400,
    ].find((value) => value * pixelsPerSecond >= 80) ?? duration;
  const first = Math.max(
    0,
    Math.floor(scrollLeft / pixelsPerSecond / interval) - 1,
  );
  const last = Math.min(
    Math.floor(duration / interval),
    Math.ceil((scrollLeft + width) / pixelsPerSecond / interval) + 1,
  );
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) =>
    Number(((first + index) * interval).toFixed(3)),
  );
};
