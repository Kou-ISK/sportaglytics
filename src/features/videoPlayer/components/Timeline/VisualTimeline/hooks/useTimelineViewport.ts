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
      zoomAnchorRef.current = {
        time: coordinateMapper.contentXToTime(
          target.scrollLeft + viewportX - TIMELINE_ROW_HEADER_WIDTH_PX,
        ),
        viewportX,
      };
    },
    [coordinateMapper],
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
    setScrollLeft(nextScrollLeft);
  }, [coordinateMapper]);

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
