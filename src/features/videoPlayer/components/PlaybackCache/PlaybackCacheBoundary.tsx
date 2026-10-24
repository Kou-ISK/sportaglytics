import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { CachePlayerContext } from './CachePlayerContext';
import { usePlaybackCacheController } from './usePlaybackCacheController';
import { PlaybackCachePanelView } from './PlaybackCachePanelView';
export const PlaybackCacheBoundary = ({
  children,
  eligible,
  playing,
  timelineTime,
  pause,
}: {
  children: ReactNode;
  eligible: boolean;
  playing: boolean;
  timelineTime: number;
  pause: () => void;
}): ReactElement => {
  const [open, setOpen] = useState(false);
  const controller = usePlaybackCacheController(
    eligible,
    playing,
    timelineTime,
    pause,
  );
  const value = controller.snapshot;
  if (!eligible) return <>{children}</>;
  return (
    <CachePlayerContext.Provider value={controller.context}>
      <PlaybackCachePanelView
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        error={controller.error}
        onRetryOriginal={controller.onRetryOriginal}
        switching={controller.switching}
        cache={
          value?.source
            ? {
                ...controller,
                status: value.status,
                estimate: null,
                canPrepare: value.available && !controller.switching,
                paused: !playing && !controller.switching,
              }
            : null
        }
      >
        {children}
      </PlaybackCachePanelView>
    </CachePlayerContext.Provider>
  );
};
