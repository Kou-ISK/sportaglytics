import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Playlist,
  PlaylistItem,
  PlaylistState,
} from '../../types/Playlist';
import type { TimelineData } from '../../types/TimelineData';
import { usePlaylistStateActions } from './hooks/usePlaylistStateActions';
import { usePlaylistWindowBridge } from './hooks/usePlaylistWindowBridge';
import type { PlayItemCallback, SeekCallback } from './hooks/playlistCallbacks';
import { buildPlaylistItemsFromTimeline } from './utils/buildPlaylistItemsFromTimeline';

interface PlaylistContextValue {
  state: PlaylistState;
  activePlaylist: Playlist | null;
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  updatePlaylistName: (playlistId: string, name: string) => void;
  setActivePlaylist: (playlistId: string | null) => void;
  addItemsFromTimeline: (
    playlistId: string,
    items: TimelineData[],
    videoPath?: string | null,
    videoPath2?: string | null,
  ) => void;
  addItems: (playlistId: string, items: PlaylistItem[]) => void;
  removeItem: (playlistId: string, itemId: string) => void;
  reorderItems: (playlistId: string, fromIndex: number, toIndex: number) => void;
  updateItemNote: (playlistId: string, itemId: string, note: string) => void;
  setLoopMode: (mode: 'none' | 'single' | 'all') => void;
  setPlayingItem: (itemId: string | null) => void;
  openPlaylistWindow: () => Promise<void>;
  isWindowOpen: boolean;
  syncToWindow: (
    currentTime: number,
    videoPath: string | null,
    videoPath2?: string | null,
    packagePath?: string,
  ) => void;
  addItemsToAllWindows: (
    items: PlaylistItem[],
    videoSources?: { primary?: string | null; secondary?: string | null },
  ) => Promise<void>;
  addTimelineItemsToAllWindows: (
    items: TimelineData[],
    videoSources?: { primary?: string | null; secondary?: string | null },
  ) => Promise<void>;
  registerSeekCallback: (callback: SeekCallback) => void;
  registerPlayItemCallback: (callback: PlayItemCallback) => void;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

interface PlaylistProviderProps {
  children: ReactNode;
}

export const PlaylistProvider: React.FC<PlaylistProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<PlaylistState>({
    playlists: [],
    activePlaylistId: null,
    playingItemId: null,
    loopMode: 'none',
  });
  const [isWindowOpen, setIsWindowOpen] = useState(false);

  const seekCallbackRef = useRef<SeekCallback | null>(null);
  const playItemCallbackRef = useRef<PlayItemCallback | null>(null);

  const registerSeekCallback = useCallback((callback: SeekCallback) => {
    seekCallbackRef.current = callback;
  }, []);

  const registerPlayItemCallback = useCallback((callback: PlayItemCallback) => {
    playItemCallbackRef.current = callback;
  }, []);

  const activePlaylist = useMemo(() => {
    if (!state.activePlaylistId) return null;
    return state.playlists.find((p) => p.id === state.activePlaylistId) ?? null;
  }, [state.playlists, state.activePlaylistId]);

  const {
    createPlaylist,
    deletePlaylist,
    updatePlaylistName,
    setActivePlaylist,
    addItemsFromTimeline,
    addItems,
    removeItem,
    reorderItems,
    updateItemNote,
    setLoopMode,
    setPlayingItem,
  } = usePlaylistStateActions({ setState });

  const { openPlaylistWindow, addItemsToAllWindows, syncToWindow } =
    usePlaylistWindowBridge({
      state,
      isWindowOpen,
      setIsWindowOpen,
      setState,
      setPlayingItem,
      seekCallbackRef,
      playItemCallbackRef,
    });

  const addTimelineItemsToAllWindows = useCallback(
    async (
      items: TimelineData[],
      videoSources?: { primary?: string | null; secondary?: string | null },
    ) => {
      await addItemsToAllWindows(
        buildPlaylistItemsFromTimeline(items, { videoSources }),
        videoSources,
      );
    },
    [addItemsToAllWindows],
  );

  const value: PlaylistContextValue = {
    state,
    activePlaylist,
    createPlaylist,
    deletePlaylist,
    updatePlaylistName,
    setActivePlaylist,
    addItemsFromTimeline,
    addItems,
    removeItem,
    reorderItems,
    updateItemNote,
    setLoopMode,
    setPlayingItem,
    openPlaylistWindow,
    isWindowOpen,
    syncToWindow,
    addItemsToAllWindows,
    addTimelineItemsToAllWindows,
    registerSeekCallback,
    registerPlayItemCallback,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylist = (): PlaylistContextValue => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
};
