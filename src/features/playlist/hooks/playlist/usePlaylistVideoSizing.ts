import { useLayoutEffect } from 'react';

type Size = { width: number; height: number };
type ContentRect = { width: number; height: number; offsetX: number; offsetY: number };

interface UsePlaylistVideoSizingParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoRef2: React.RefObject<HTMLVideoElement>;
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  viewMode: 'dual' | 'angle1' | 'angle2';
  setPrimaryCanvasSize: React.Dispatch<React.SetStateAction<Size>>;
  setPrimarySourceSize: React.Dispatch<React.SetStateAction<Size>>;
  setPrimaryContentRect: React.Dispatch<React.SetStateAction<ContentRect>>;
  setSecondaryCanvasSize: React.Dispatch<React.SetStateAction<Size>>;
  setSecondarySourceSize: React.Dispatch<React.SetStateAction<Size>>;
  setSecondaryContentRect: React.Dispatch<React.SetStateAction<ContentRect>>;
}

const updateSizing = (
  video: HTMLVideoElement,
  setCanvasSize: React.Dispatch<React.SetStateAction<Size>>,
  setSourceSize: React.Dispatch<React.SetStateAction<Size>>,
  setContentRect: React.Dispatch<React.SetStateAction<ContentRect>>,
) => {
  const containerWidth = video.clientWidth || 1920;
  const containerHeight = video.clientHeight || 1080;
  setCanvasSize({
    width: containerWidth,
    height: containerHeight,
  });
  const naturalWidth = video.videoWidth || containerWidth;
  const naturalHeight = video.videoHeight || containerHeight;
  if (naturalWidth && naturalHeight) {
    setSourceSize({ width: naturalWidth, height: naturalHeight });
  }
  const scale = Math.min(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight,
  );
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  setContentRect({
    width: displayWidth,
    height: displayHeight,
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
  });
};

export const usePlaylistVideoSizing = ({
  videoRef,
  videoRef2,
  currentVideoSource,
  currentVideoSource2,
  viewMode,
  setPrimaryCanvasSize,
  setPrimarySourceSize,
  setPrimaryContentRect,
  setSecondaryCanvasSize,
  setSecondarySourceSize,
  setSecondaryContentRect,
}: UsePlaylistVideoSizingParams) => {
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      updateSizing(
        video,
        setPrimaryCanvasSize,
        setPrimarySourceSize,
        setPrimaryContentRect,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(video);
    return () => ro.disconnect();
  }, [
    currentVideoSource,
    setPrimaryCanvasSize,
    setPrimaryContentRect,
    setPrimarySourceSize,
    videoRef,
    viewMode,
  ]);

  useLayoutEffect(() => {
    const video = videoRef2.current;
    if (!video) return;

    const update = () => {
      updateSizing(
        video,
        setSecondaryCanvasSize,
        setSecondarySourceSize,
        setSecondaryContentRect,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(video);
    return () => ro.disconnect();
  }, [
    currentVideoSource2,
    setSecondaryCanvasSize,
    setSecondaryContentRect,
    setSecondarySourceSize,
    videoRef2,
    viewMode,
  ]);
};
