import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { NativeGroupTimeline } from '../../shared/nativePlayback/nativeGroupTimeline';
import type { NativePlaybackControls } from '../../shared/nativePlayback/nativePlaybackController';
import { NativeGroupSurfaceContext } from './NativeGroupSurfaceContext';
import { CachePlayerContext } from '../PlaybackCache/CachePlayerContext';
import { NativePlaybackControlsContext } from './NativePlaybackControlsContext';
import { NativePlaybackBoundaryView } from './NativePlaybackBoundaryView';
import { useNativeGroupSurfaces } from './useNativeGroupSurfaces';
import { useNativeGroupPlaybackPanel } from './useNativeGroupPlaybackPanel';
export const NativeGroupPlaybackBoundary = ({
  timeline,
  playing,
  time,
  pause,
  restored,
  children,
}: {
  timeline: NativeGroupTimeline;
  playing: boolean;
  time: number;
  pause: () => void;
  restored: (time: number, controls: NativePlaybackControls) => void;
  children: ReactNode;
}): ReactElement => {
  const surfaces = useNativeGroupSurfaces(timeline);
  const native = useNativeGroupPlaybackPanel(
    timeline,
    playing,
    time,
    pause,
    restored,
    surfaces,
  );
  const surfaceContext = useMemo(
    () => ({ register: surfaces.register }),
    [surfaces.register],
  );
  const playerContext = useMemo(
    () => ({ register: native.register }),
    [native.register],
  );
  return (
    <NativeGroupSurfaceContext.Provider value={surfaceContext}>
      <CachePlayerContext.Provider value={playerContext}>
        <NativePlaybackControlsContext.Provider value={native.view}>
          <NativePlaybackBoundaryView warning={native.warning}>
            {children}
          </NativePlaybackBoundaryView>
        </NativePlaybackControlsContext.Provider>
      </CachePlayerContext.Provider>
    </NativeGroupSurfaceContext.Provider>
  );
};
