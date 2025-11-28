import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseTimelineViewportParams {
  maxSec: number;
  currentTime: number;
}

export const useTimelineViewport = ({
  maxSec,
  currentTime,
}: UseTimelineViewportParams) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ズームスケール（1 = 等倍、2 = 2倍拡大）
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ホイールイベントでズーム
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleWheel = (event: WheelEvent) => {
      // Ctrl/Cmd + ホイールまたはピンチジェスチャーでズーム
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        const delta = -event.deltaY;
        const zoomFactor = 1 + delta * 0.001;

        setZoomScale((prev) => {
          const newScale = Math.max(1, Math.min(10, prev * zoomFactor));
          return newScale;
        });
      }
    };

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollContainer.removeEventListener('wheel', handleWheel);
  }, []);

  const timeToPosition = useCallback(
    (time: number) => {
      if (maxSec <= 0) return 0;
      return (time / maxSec) * containerWidth * zoomScale;
    },
    [containerWidth, maxSec, zoomScale],
  );

  const positionToTime = useCallback(
    (positionPx: number) => {
      if (maxSec <= 0 || containerWidth <= 0 || zoomScale <= 0) return 0;
      return (positionPx / (containerWidth * zoomScale)) * maxSec;
    },
    [containerWidth, maxSec, zoomScale],
  );

  const currentTimePosition = useMemo(() => {
    if (maxSec <= 0) return 0;
    return timeToPosition(currentTime);
  }, [currentTime, maxSec, timeToPosition]);

  return {
    containerRef,
    scrollContainerRef,
    zoomScale,
    containerWidth,
    timeToPosition,
    positionToTime,
    currentTimePosition,
  };
};
