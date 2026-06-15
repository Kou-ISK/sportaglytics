import { useEffect } from 'react';

interface UsePlaylistControlsVisibilityParams {
  isVideoAreaHovered: boolean;
  isPlaying: boolean;
  isDrawingMode: boolean;
  interactionId: number;
  setControlsVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistControlsVisibility = ({
  isVideoAreaHovered,
  isPlaying,
  isDrawingMode,
  interactionId,
  setControlsVisible,
}: UsePlaylistControlsVisibilityParams) => {
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    if (!isVideoAreaHovered) {
      setControlsVisible(false);
      return () => undefined;
    }

    setControlsVisible(true);
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isDrawingMode && isPlaying) {
        setControlsVisible(false);
      }
    }, 1800);

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [
    interactionId,
    isDrawingMode,
    isPlaying,
    isVideoAreaHovered,
    setControlsVisible,
  ]);
};
