import { useNativeCacheActions } from './useNativeCacheActions';
import { useMemo, useState } from 'react';
import { useNativePlaybackPanel } from '../NativePlayback/useNativePlaybackPanel';
import { NativePlaybackPanelView } from '../NativePlayback/NativePlaybackPanelView';
import type { NativePlaybackControls } from '../../shared/nativePlayback/nativePlaybackController';
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
  onNativeRestored,
}: {
  children: ReactNode;
  eligible: boolean;
  playing: boolean;
  timelineTime: number;
  pause: () => void;
  onNativeRestored: (time: number, controls: NativePlaybackControls) => void;
}): ReactElement => {
  const [open, setOpen] = useState(false);
  const controller = usePlaybackCacheController(
    eligible,
    playing,
    timelineTime,
    pause,
  );
  const nativeCache = useNativeCacheActions(controller);
  const native = useNativePlaybackPanel(
    eligible,
    playing,
    pause,
    onNativeRestored,
  );
  const context = useMemo(
    () => ({
      register: (
        player: Parameters<typeof native.register>[0],
      ): (() => void) => {
        const releaseCache = controller.context.register(player);
        const releaseNative = native.register(player);
        return () => {
          releaseNative();
          releaseCache();
        };
      },
    }),
    [controller.context, native.register],
  );
  const value = controller.snapshot;
  if (!eligible) return <>{children}</>;
  return (
    <CachePlayerContext.Provider value={context}>
      <PlaybackCachePanelView
        playbackControls={
          native.view && <NativePlaybackPanelView {...native.view} />
        }
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        error={nativeCache.error ?? controller.error}
        onRetryOriginal={controller.onRetryOriginal}
        switching={controller.switching || nativeCache.switching}
        cache={
          value?.source
            ? {
                ...controller,
                onUseCache: nativeCache.onUseCache,
                onUseOriginal: nativeCache.onUseOriginal,
                status: value.status,
                estimate: null,
                canPrepare:
                  value.available &&
                  !controller.switching &&
                  !nativeCache.switching,
                paused:
                  !playing && !controller.switching && !nativeCache.switching,
              }
            : null
        }
      >
        {children}
      </PlaybackCachePanelView>
    </CachePlayerContext.Provider>
  );
};
