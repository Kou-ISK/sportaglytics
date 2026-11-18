import { NativeGroupPlaybackBoundary } from '../NativePlayback/NativeGroupPlaybackBoundary';
import type { NativeGroupTimeline } from '../../shared/nativePlayback/nativeGroupTimeline';
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
  timelineTime,
  groupTimeline,
}: {
  children: ReactNode;
  eligible: boolean;
  playing: boolean;
  timelineTime: number;
  groupTimeline?: NativeGroupTimeline | null;
  pause: () => void;
  onNativeRestored: (time: number, controls: NativePlaybackControls) => void;
}): ReactElement => {
  const native = useNativePlaybackPanel(
    eligible && !groupTimeline,
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
  if (groupTimeline)
    return (
      <NativeGroupPlaybackBoundary
        timeline={groupTimeline}
        playing={playing}
        time={timelineTime}
        pause={pause}
        restored={onNativeRestored}
      >
        {children}
      </NativeGroupPlaybackBoundary>
    );
  return (
    <CachePlayerContext.Provider value={context}>
      <NativePlaybackControlsContext.Provider value={native.view}>
        <NativePlaybackBoundaryView>{children}</NativePlaybackBoundaryView>
      </NativePlaybackControlsContext.Provider>
    </CachePlayerContext.Provider>
  );
};
