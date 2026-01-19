import { useEffect } from 'react';

interface UsePlaylistControlsVisibilityParams {
  containerRef: React.RefObject<HTMLDivElement>;
  isPlaying: boolean;
  isDrawingMode: boolean;
  setControlsVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistControlsVisibility = ({
  containerRef,
  isPlaying,
  isDrawingMode,
  setControlsVisible,
}: UsePlaylistControlsVisibilityParams) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      setControlsVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isDrawingMode && isPlaying) {
          setControlsVisible(false);
        }
      }, 1800);
    };

    if (isPlaying && !isDrawingMode) {
      show();
    }
    const handleMove = () => show();
    const handleLeave = () => setControlsVisible(false);

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseleave', handleLeave);

    return () => {
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseleave', handleLeave);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [containerRef, isDrawingMode, isPlaying, setControlsVisible]);
};
