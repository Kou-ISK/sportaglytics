import { useCallback, useMemo } from 'react';
import type { ItemAnnotation, PlaylistItem } from '../../../types/Playlist';

interface UsePlaylistVideoControlsStateParams {
  currentItem: PlaylistItem | null;
  currentAnnotation: ItemAnnotation | null;
  duration: number;
  autoAdvance: boolean;
  loopPlaylist: boolean;
  isMuted: boolean;
  setAutoAdvance: React.Dispatch<React.SetStateAction<boolean>>;
  setLoopPlaylist: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
}

interface SliderMark {
  value: number;
  label: string;
}

interface UsePlaylistVideoControlsStateResult {
  sliderMin: number;
  sliderMax: number;
  marks: SliderMark[];
  handleSeekCommitted: () => void;
  handleToggleAutoAdvance: () => void;
  handleToggleLoop: () => void;
  handleToggleMute: () => void;
}

export const usePlaylistVideoControlsState = ({
  currentItem,
  currentAnnotation,
  duration,
  autoAdvance,
  loopPlaylist,
  isMuted,
  setAutoAdvance,
  setLoopPlaylist,
  setIsMuted,
}: UsePlaylistVideoControlsStateParams): UsePlaylistVideoControlsStateResult => {
  const sliderMin = currentItem?.startTime ?? 0;
  const sliderMax = currentItem?.endTime ?? duration;

  const marks = useMemo(() => {
    return currentAnnotation?.objects?.length
      ? currentAnnotation.objects.map((obj) => ({
          value: obj.timestamp,
          label: '',
        }))
      : [];
  }, [currentAnnotation]);

  const handleSeekCommitted = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleToggleAutoAdvance = useCallback(() => {
    setAutoAdvance(!autoAdvance);
  }, [autoAdvance, setAutoAdvance]);

  const handleToggleLoop = useCallback(() => {
    setLoopPlaylist(!loopPlaylist);
  }, [loopPlaylist, setLoopPlaylist]);

  const handleToggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted, setIsMuted]);

  return {
    sliderMin,
    sliderMax,
    marks,
    handleSeekCommitted,
    handleToggleAutoAdvance,
    handleToggleLoop,
    handleToggleMute,
  };
};
