import type { RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createTimelineCoordinateMapper,
  TIMELINE_ROW_HEADER_WIDTH_PX,
} from '../domain/timelineCoordinateMapper';

import {
  MIN_ZOOM_SCALE,
  MAX_ZOOM_SCALE,
  clampZoomScale,
  wheelZoomFactor,
  calculateAnchoredScrollLeft,
} from '../domain/timelineZoom';

interface UseTimelineViewportParams {
  maxSec: number;
  currentTime: number;
}

export interface TimelineContainerPoint {
  x: number;
  y: number;
}

export const useTimelineViewport = ({
  maxSec,
  currentTime,
}: UseTimelineViewportParams): {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  zoomScale: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  containerWidth: number;
  timeToPosition: (time: number) => number;
  positionToTime: (position: number) => number;
  clientXToContentX: (clientX: number) => number;
  clientPointToContainerPoint: (x: number, y: number) => TimelineContainerPoint;
  currentTimePosition: number;
  scrollLeft: number;
} => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const zoomAnchorRef = useRef<{ time: number; viewportX: number } | null>(
    null,
  );
  const appliedAnchorRef = useRef<{
    time: number;
    viewportX: number;
    scrollLeft: number;
    baseWidth: number;
    maxSec: number;
  } | null>(null);

  useEffect(() => {
    const target = scrollContainerRef.current;
    if (!target) return;
    const computeWidth = (): void => {
      const style = getComputedStyle(target);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const raw =
        target.clientWidth -
        TIMELINE_ROW_HEADER_WIDTH_PX -
        paddingLeft -
        paddingRight;
      if (raw > 0) {
        setBaseWidth(raw);
      }
    };
    computeWidth();
    const resizeObserver = new ResizeObserver(computeWidth);
    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const target = scrollContainerRef.current;
    if (!target) return;
    const handleScroll = (): void => setScrollLeft(target.scrollLeft);
    target.addEventListener('scroll', handleScroll);
    return () => target.removeEventListener('scroll', handleScroll);
  }, []);

  const coordinateMapper = useMemo(
    () =>
      createTimelineCoordinateMapper({
        maxSec,
        baseContentWidth: baseWidth,
        zoomScale,
      }),
    [baseWidth, maxSec, zoomScale],
  );
  const setAnchor = useCallback(
    (viewportX: number): void => {
      const target = scrollContainerRef.current;
      if (!target) return;
      const previous = appliedAnchorRef.current;
      // Retain the logical time: reading rounded scrollLeft at every pinch
      // event would magnify a subpixel error with each successive zoom.
      const reuseAnchor =
        previous !== null &&
        previous.viewportX === viewportX &&
        previous.scrollLeft === target.scrollLeft &&
        previous.baseWidth === baseWidth &&
        previous.maxSec === maxSec;
      zoomAnchorRef.current = {
        time: reuseAnchor
          ? previous.time
          : coordinateMapper.contentXToTime(
              target.scrollLeft + viewportX - TIMELINE_ROW_HEADER_WIDTH_PX,
            ),
        viewportX,
      };
    },
    [baseWidth, coordinateMapper, maxSec],
  );

  useEffect(() => {
    const target = scrollContainerRef.current;
    if (!target) return;
    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setAnchor(
        Math.max(
          TIMELINE_ROW_HEADER_WIDTH_PX,
          Math.min(
            target.clientWidth,
            event.clientX - target.getBoundingClientRect().left,
          ),
        ),
      );
      setZoomScale((previous) =>
        clampZoomScale(
          previous * wheelZoomFactor(event.deltaY, event.deltaMode),
        ),
      );
    };
    target.addEventListener('wheel', handleWheel, { passive: false });
    return () => target.removeEventListener('wheel', handleWheel);
  }, [setAnchor]);

  const changeZoom = useCallback(
    (factor: number): void => {
      const target = scrollContainerRef.current;
      if (target)
        setAnchor((target.clientWidth + TIMELINE_ROW_HEADER_WIDTH_PX) / 2);
      setZoomScale((previous) => clampZoomScale(previous * factor));
    },
    [setAnchor],
  );
  const zoomIn = useCallback((): void => changeZoom(1.5), [changeZoom]);
  const zoomOut = useCallback((): void => changeZoom(1 / 1.5), [changeZoom]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (anchor === null || !scrollContainer) {
      return;
    }

    zoomAnchorRef.current = null;
    const nextScrollLeft = calculateAnchoredScrollLeft({
      anchorTime: anchor.time,
      anchorViewportX: anchor.viewportX,
      headerWidth: TIMELINE_ROW_HEADER_WIDTH_PX,
      viewportWidth: scrollContainer.clientWidth,
      scrollWidth: scrollContainer.scrollWidth,
      timeToPosition: coordinateMapper.timeToContentX,
    });
    scrollContainer.scrollLeft = nextScrollLeft;
    const actualScrollLeft = scrollContainer.scrollLeft;
    const requestedScrollLeft =
      TIMELINE_ROW_HEADER_WIDTH_PX +
      coordinateMapper.timeToContentX(anchor.time) -
      anchor.viewportX;
    // At a scroll boundary the original point cannot remain under the cursor.
    // The next gesture must anchor to the position actually visible there.
    appliedAnchorRef.current =
      Math.abs(nextScrollLeft - requestedScrollLeft) < 0.001
        ? { ...anchor, scrollLeft: actualScrollLeft, baseWidth, maxSec }
        : null;
    setScrollLeft(actualScrollLeft);
  }, [baseWidth, coordinateMapper, maxSec]);

  const clientXToContentX = useCallback(
    (clientX: number): number => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return 0;
      return coordinateMapper.clientXToContentX(clientX, containerRect.left);
    },
    [coordinateMapper],
  );

  const clientPointToContainerPoint = useCallback(
    (clientX: number, clientY: number): TimelineContainerPoint => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return { x: 0, y: 0 };
      return {
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      };
    },
    [],
  );

  const currentTimePosition = useMemo(
    () => coordinateMapper.timeToContentX(currentTime),
    [coordinateMapper, currentTime],
  );

  return {
    containerRef,
    scrollContainerRef,
    zoomScale,
    canZoomOut: zoomScale > MIN_ZOOM_SCALE,
    canZoomIn: zoomScale < MAX_ZOOM_SCALE,
    zoomIn,
    zoomOut,
    containerWidth: baseWidth,
    timeToPosition: coordinateMapper.timeToContentX,
    positionToTime: coordinateMapper.contentXToTime,
    clientXToContentX,
    clientPointToContainerPoint,
    currentTimePosition,
    scrollLeft,
  };
};
