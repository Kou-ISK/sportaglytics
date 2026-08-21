import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createTimelineCoordinateMapper,
  TIMELINE_ROW_HEADER_WIDTH_PX,
} from '../domain/timelineCoordinateMapper';

const MIN_ZOOM_SCALE = 1;
const MAX_ZOOM_SCALE = 10;
const ZOOM_BUTTON_STEP = 0.25;

const clampZoomScale = (value: number): number =>
  Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, value));

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
}: UseTimelineViewportParams) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);

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

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = -event.deltaY;
      const zoomFactor = 1 + delta * 0.001;
      setZoomScale((previous) => clampZoomScale(previous * zoomFactor));
    };

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollContainer.removeEventListener('wheel', handleWheel);
  }, []);

  const zoomIn = useCallback((): void => {
    setZoomScale((previous) =>
      clampZoomScale(
        Math.round((previous + ZOOM_BUTTON_STEP) * 100) / 100,
      ),
    );
  }, []);

  const zoomOut = useCallback((): void => {
    setZoomScale((previous) =>
      clampZoomScale(
        Math.round((previous - ZOOM_BUTTON_STEP) * 100) / 100,
      ),
    );
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
