import { NativePlaybackBoundaryView } from '../NativePlayback/NativePlaybackBoundaryView';
import { useMemo } from 'react';
import { useNativePlaybackPanel } from '../NativePlayback/useNativePlaybackPanel';
import { NativePlaybackControlsContext } from '../NativePlayback/NativePlaybackControlsContext';
import type { NativePlaybackControls } from '../../shared/nativePlayback/nativePlaybackController';
import type { ReactElement, ReactNode } from 'react';
import { CachePlayerContext } from './CachePlayerContext';
export const PlaybackCacheBoundary = ({
  children,
  eligible,
  playing,
  pause,
  onNativeRestored,
}: {
  children: ReactNode;
  eligible: boolean;
  playing: boolean;
  timelineTime: number;
  pause: () => void;
  onNativeRestored: (time: number, controls: NativePlaybackControls) => void;
}): ReactElement => {
  const native = useNativePlaybackPanel(
    eligible,
    playing,
    pause,
    onNativeRestored,
  );
  const context = useMemo(
    () => ({
      register: native.register,
    }),
    [native.register],
  );
  if (!eligible) return <>{children}</>;
  return (
    <CachePlayerContext.Provider value={context}>
      <NativePlaybackControlsContext.Provider value={native.view}>
        <NativePlaybackBoundaryView>{children}</NativePlaybackBoundaryView>
      </NativePlaybackControlsContext.Provider>
    </CachePlayerContext.Provider>
  );
};
