import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseTimelineViewportParams {
  maxSec: number;
  currentTime: number;
}

export const useTimelineViewport = ({
  maxSec,
  currentTime,
}: UseTimelineViewportParams) => {
  // バー描画領域（実際にバーを置く要素）
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // スクロール領域全体（ラベル含む）
  const [baseWidth, setBaseWidth] = useState(0); // バー描画領域幅のみ

  // ズームスケール（1 = 等倍、2 = 2倍拡大）
  const [zoomScale, setZoomScale] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const LABEL_WIDTH = 120;

  useEffect(() => {
    const target = scrollContainerRef.current;
    if (!target) return;
    const computeWidth = () => {
      const style = getComputedStyle(target);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      // パネル内に収まるように余白を考慮した幅を計算
      // ズーム100%時に映像全体が表示される
      // タイムライン軸の右端 = 映像の終端位置
      const raw = target.clientWidth - LABEL_WIDTH - paddingLeft - paddingRight;
      if (raw > 0) {
        setBaseWidth(raw);
      }
    };
    computeWidth();
    const resizeObserver = new ResizeObserver(() => computeWidth());
    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const target = scrollContainerRef.current;
    if (!target) return;
    const handleScroll = () => setScrollLeft(target.scrollLeft);
    target.addEventListener('scroll', handleScroll);
    return () => target.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

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
      if (maxSec <= 0 || baseWidth <= 0) return 0;
      return (time / maxSec) * baseWidth * zoomScale;
    },
    [baseWidth, maxSec, zoomScale],
  );

  const positionToTime = useCallback(
    (positionPx: number) => {
      if (maxSec <= 0 || baseWidth <= 0 || zoomScale <= 0) return 0;
      return (positionPx / (baseWidth * zoomScale)) * maxSec;
    },
    [baseWidth, maxSec, zoomScale],
  );

  const currentTimePosition = useMemo(() => {
    if (maxSec <= 0) return 0;
    return timeToPosition(currentTime);
  }, [currentTime, maxSec, timeToPosition]);

  return {
    containerRef,
    scrollContainerRef,
    zoomScale,
    containerWidth: baseWidth,
    timeToPosition,
    positionToTime,
    currentTimePosition,
    scrollLeft,
  };
};
