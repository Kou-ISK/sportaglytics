import { useEffect } from 'react';
import type { AnnotationTarget } from '../../../types/Playlist';

interface UsePlaylistDrawingTargetParams {
  viewMode: 'dual' | 'angle1' | 'angle2';
  currentVideoSource2: string | null;
  setDrawingTarget: React.Dispatch<React.SetStateAction<AnnotationTarget>>;
}

export const usePlaylistDrawingTarget = ({
  viewMode,
  currentVideoSource2,
  setDrawingTarget,
}: UsePlaylistDrawingTargetParams) => {
  useEffect(() => {
    if (viewMode === 'angle1') {
      setDrawingTarget('primary');
    } else if (viewMode === 'angle2') {
      setDrawingTarget('secondary');
    } else if (!currentVideoSource2) {
      setDrawingTarget('primary');
    }
  }, [currentVideoSource2, setDrawingTarget, viewMode]);
};
