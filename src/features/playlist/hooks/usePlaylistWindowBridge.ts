import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { PlaylistItem, PlaylistState } from '../../../types/playlist/core';
import { getPresentationItems } from '../../../shared/playlist/playlistDocument';
import type {
  PlaylistCommand,
  PlaylistSyncData,
} from '../../../types/playlist/window';
import type { PlayItemCallback, SeekCallback } from './playlistCallbacks';
import {
  deliverItemsToPlaylistWindow,
  observePlaylistWindowState,
  openPlaylistWindow as openPlaylistWindowGateway,
  subscribePlaylistCommand,
  subscribePlaylistWindowClosed,
  syncPlaylistWindow,
} from '../gateway/playlistWindowGateway';

interface UsePlaylistWindowBridgeParams {
  state: PlaylistState;
  isWindowOpen: boolean;
  setIsWindowOpen: (open: boolean) => void;
  setState: Dispatch<SetStateAction<PlaylistState>>;
  setPlayingItem: (itemId: string | null) => void;
  seekCallbackRef: MutableRefObject<SeekCallback | null>;
  playItemCallbackRef: MutableRefObject<PlayItemCallback | null>;
}

interface UsePlaylistWindowBridgeResult {
  openPlaylistWindow: () => Promise<void>;
  addItemsToPlaylistWindow: (
    items: PlaylistItem[],
    videoSources?: { primary?: string | null; secondary?: string | null },
  ) => Promise<void>;
  syncToWindow: (
    currentTime: number,
    videoPath: string | null,
    videoPath2?: string | null,
    packagePath?: string,
  ) => void;
}

export const usePlaylistWindowBridge = ({
  state,
  isWindowOpen,
  setIsWindowOpen,
  setState,
  setPlayingItem,
  seekCallbackRef,
  playItemCallbackRef,
}: UsePlaylistWindowBridgeParams): UsePlaylistWindowBridgeResult => {
  const openPlaylistWindow = useCallback(async () => {
    const opened = await openPlaylistWindowGateway();
    if (opened) {
      setIsWindowOpen(true);
    }
  }, [setIsWindowOpen]);

  const addItemsToPlaylistWindow = useCallback(
    async (
      items: PlaylistItem[],
      videoSources?: { primary?: string | null; secondary?: string | null },
    ) => {
      if (items.length === 0) return;

      const added = await deliverItemsToPlaylistWindow(
        items.map((item) => ({
          ...item,
          videoSource: item.videoSource ?? videoSources?.primary ?? undefined,
          videoSource2:
            item.videoSource2 ?? videoSources?.secondary ?? undefined,
        })),
      );
      if (added) setIsWindowOpen(true);
    },
    [setIsWindowOpen],
  );

  const syncToWindow = useCallback(
    (
      currentTime: number,
      videoPath: string | null,
      videoPath2?: string | null,
      packagePath?: string,
    ) => {
      if (!isWindowOpen) return;
      const videoSources: string[] = [];
      if (videoPath) videoSources.push(videoPath);
      if (videoPath2) videoSources.push(videoPath2);

      const syncData: PlaylistSyncData = {
        state,
        videoPath,
        videoPath2: videoPath2 || null,
        videoSources,
        currentTime,
        packagePath,
      };
      syncPlaylistWindow(syncData);
    },
    [state, isWindowOpen],
  );

  useEffect(() => {
    const handleCommand = (command: PlaylistCommand) => {
      switch (command.type) {
        case 'seek':
          seekCallbackRef.current?.(command.time);
          break;
        case 'play-item': {
          const item = state.playlists
            .flatMap((p) =>
              p.rows || p.schemaVersion ? getPresentationItems(p) : p.items,
            )
            .find((playlistItem) => playlistItem.id === command.itemId);
          if (item) {
            setPlayingItem(item.id);
            playItemCallbackRef.current?.(item);
          }
          break;
        }
        case 'update-state':
          setState(command.state);
          break;
        case 'request-sync':
          break;
      }
    };

    const handleWindowClosed = () => {
      setIsWindowOpen(false);
    };

    const unsubscribeCommand = subscribePlaylistCommand(handleCommand);
    const unsubscribeWindowClosed =
      subscribePlaylistWindowClosed(handleWindowClosed);

    return () => {
      unsubscribeCommand();
      unsubscribeWindowClosed();
    };
  }, [
    playItemCallbackRef,
    seekCallbackRef,
    setIsWindowOpen,
    setPlayingItem,
    setState,
    state.playlists,
  ]);

  useEffect(() => {
    return observePlaylistWindowState(setIsWindowOpen);
  }, [setIsWindowOpen]);

  return {
    openPlaylistWindow,
    addItemsToPlaylistWindow,
    syncToWindow,
  };
};
