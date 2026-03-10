import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type {
  PlaylistItem,
  PlaylistCommand,
  PlaylistState,
  PlaylistSyncData,
} from '../../../types/Playlist';
import type { PlayItemCallback, SeekCallback } from './playlistCallbacks';

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
  addItemsToAllWindows: (
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
  const ensurePlaylistWindowOpen = useCallback(async () => {
    const playlistApi = window.electronAPI?.playlist;
    if (!playlistApi) return null;

    const count = await playlistApi.getOpenWindowCount();
    if (count > 0) {
      return playlistApi;
    }

    await playlistApi.openWindow();
    setIsWindowOpen(true);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 500);
    });
    return playlistApi;
  }, [setIsWindowOpen]);

  const openPlaylistWindow = useCallback(async () => {
    if (!window.electronAPI?.playlist) return;
    await window.electronAPI.playlist.openWindow();
    setIsWindowOpen(true);
  }, [setIsWindowOpen]);

  const addItemsToAllWindows = useCallback(
    async (
      items: PlaylistItem[],
      videoSources?: { primary?: string | null; secondary?: string | null },
    ) => {
      if (items.length === 0) return;

      const playlistApi = await ensurePlaylistWindowOpen();
      if (!playlistApi) return;

      for (const item of items) {
        await playlistApi.addItemToAllWindows({
          ...item,
          videoSource: item.videoSource ?? videoSources?.primary ?? undefined,
          videoSource2: item.videoSource2 ?? videoSources?.secondary ?? undefined,
        });
      }
    },
    [ensurePlaylistWindowOpen],
  );

  const syncToWindow = useCallback(
    (
      currentTime: number,
      videoPath: string | null,
      videoPath2?: string | null,
      packagePath?: string,
    ) => {
      if (!window.electronAPI?.playlist || !isWindowOpen) return;
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
      window.electronAPI.playlist.syncToWindow(syncData);
    },
    [state, isWindowOpen],
  );

  useEffect(() => {
    if (!window.electronAPI?.playlist) return;

    const handleCommand = (command: PlaylistCommand) => {
      switch (command.type) {
        case 'seek':
          seekCallbackRef.current?.(command.time);
          break;
        case 'play-item': {
          const item = state.playlists
            .flatMap((p) => p.items)
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

    const api = window.electronAPI.playlist;
    api.onCommand(handleCommand as (cmd: unknown) => void);
    api.onWindowClosed(handleWindowClosed);

    return () => {
      window.electronAPI?.playlist?.offCommand(
        handleCommand as (cmd: unknown) => void,
      );
      window.electronAPI?.playlist?.offWindowClosed(handleWindowClosed);
    };
  }, [playItemCallbackRef, seekCallbackRef, setIsWindowOpen, setPlayingItem, setState, state.playlists]);

  useEffect(() => {
    if (!window.electronAPI?.playlist) return;

    const checkWindowState = async () => {
      const open = await window.electronAPI!.playlist.isWindowOpen();
      setIsWindowOpen(open);
    };

    void checkWindowState();
    const interval = setInterval(() => {
      void checkWindowState();
    }, 2000);
    return () => clearInterval(interval);
  }, [setIsWindowOpen]);

  return {
    openPlaylistWindow,
    addItemsToAllWindows,
    syncToWindow,
  };
};
