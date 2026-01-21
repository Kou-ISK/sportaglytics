import { useEffect } from 'react';
import type { AnnotationTarget } from '../../../../types/Playlist';
import { resolveDrawingTarget } from '../../utils/viewMode';

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
    if (viewMode !== 'dual') {
      setDrawingTarget(resolveDrawingTarget(viewMode));
    } else if (!currentVideoSource2) {
      setDrawingTarget('primary');
    }
  }, [currentVideoSource2, setDrawingTarget, viewMode]);
};
