export const TIMELINE_ROW_HEADER_WIDTH_PX = 120;
export const MIN_TIMELINE_INSTANCE_DURATION_SECONDS = 0.1;

interface TimelineCoordinateMapperParams {
  maxSec: number;
  baseContentWidth: number;
  zoomScale: number;
  rowHeaderWidth?: number;
}

export interface TimelineCoordinateMapper {
  contentWidthPx: number;
  rowHeaderWidthPx: number;
  timeToContentX: (timeSec: number) => number;
  contentXToTime: (xPx: number) => number;
  containerXToContentX: (xPx: number) => number;
  contentXToContainerX: (xPx: number) => number;
  clientXToContentX: (clientX: number, containerClientLeft: number) => number;
  contentXToViewportX: (
    xPx: number,
    containerClientLeft: number,
    viewportClientLeft: number,
  ) => number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const createTimelineCoordinateMapper = ({
  maxSec,
  baseContentWidth,
  zoomScale,
  rowHeaderWidth = TIMELINE_ROW_HEADER_WIDTH_PX,
}: TimelineCoordinateMapperParams): TimelineCoordinateMapper => {
  const safeMaxSec = Number.isFinite(maxSec) ? Math.max(0, maxSec) : 0;
  const safeBaseWidth = Number.isFinite(baseContentWidth)
    ? Math.max(0, baseContentWidth)
    : 0;
  const safeZoomScale = Number.isFinite(zoomScale)
    ? Math.max(0, zoomScale)
    : 0;
  const safeRowHeaderWidth = Number.isFinite(rowHeaderWidth)
    ? Math.max(0, rowHeaderWidth)
    : 0;
  const contentWidthPx = safeBaseWidth * safeZoomScale;

  const timeToContentX = (timeSec: number): number => {
    if (safeMaxSec <= 0 || contentWidthPx <= 0) return 0;
    const safeTime = Number.isFinite(timeSec) ? timeSec : 0;
    return (clamp(safeTime, 0, safeMaxSec) / safeMaxSec) * contentWidthPx;
  };

  const contentXToTime = (xPx: number): number => {
    if (safeMaxSec <= 0 || contentWidthPx <= 0) return 0;
    const safeX = Number.isFinite(xPx) ? xPx : 0;
    return (clamp(safeX, 0, contentWidthPx) / contentWidthPx) * safeMaxSec;
  };

  const containerXToContentX = (xPx: number): number =>
    clamp(xPx - safeRowHeaderWidth, 0, contentWidthPx);

  const contentXToContainerX = (xPx: number): number =>
    safeRowHeaderWidth + clamp(xPx, 0, contentWidthPx);

  return {
    contentWidthPx,
    rowHeaderWidthPx: safeRowHeaderWidth,
    timeToContentX,
    contentXToTime,
    containerXToContentX,
    contentXToContainerX,
    clientXToContentX: (clientX, containerClientLeft) =>
      containerXToContentX(clientX - containerClientLeft),
    contentXToViewportX: (xPx, containerClientLeft, viewportClientLeft) =>
      containerClientLeft + contentXToContainerX(xPx) - viewportClientLeft,
  };
};
