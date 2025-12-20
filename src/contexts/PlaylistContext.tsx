import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Playlist,
  PlaylistItem,
  PlaylistState,
  PlaylistSyncData,
  PlaylistCommand,
} from '../types/Playlist';
import type { TimelineData } from '../types/TimelineData';

/** シークコールバックの型 */
type SeekCallback = (time: number) => void;
/** アイテム再生コールバックの型 */
type PlayItemCallback = (item: PlaylistItem) => void;

interface PlaylistContextValue {
  /** プレイリスト状態 */
  state: PlaylistState;
  /** アクティブなプレイリスト */
  activePlaylist: Playlist | null;
  /** 新しいプレイリストを作成 */
  createPlaylist: (name: string, description?: string) => Playlist;
  /** プレイリストを削除 */
  deletePlaylist: (playlistId: string) => void;
  /** プレイリスト名を更新 */
  updatePlaylistName: (playlistId: string, name: string) => void;
  /** アクティブなプレイリストを設定 */
  setActivePlaylist: (playlistId: string | null) => void;
  /** タイムラインアイテムをプレイリストに追加 */
  addItemsFromTimeline: (
    playlistId: string,
    items: TimelineData[],
    videoPath?: string | null,
    videoPath2?: string | null,
  ) => void;
  /** プレイリストアイテムを削除 */
  removeItem: (playlistId: string, itemId: string) => void;
  /** プレイリストアイテムの順序を変更 */
  reorderItems: (
    playlistId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  /** プレイリストアイテムのメモを更新 */
  updateItemNote: (playlistId: string, itemId: string, note: string) => void;
  /** ループモードを設定 */
  setLoopMode: (mode: 'none' | 'single' | 'all') => void;
  /** 再生中アイテムを設定 */
  setPlayingItem: (itemId: string | null) => void;
  /** プレイリストウィンドウを開く */
  openPlaylistWindow: () => Promise<void>;
  /** プレイリストウィンドウが開いているか */
  isWindowOpen: boolean;
  /** プレイリストウィンドウへ同期 */
  syncToWindow: (
    currentTime: number,
    videoPath: string | null,
    videoPath2?: string | null,
    packagePath?: string,
  ) => void;
  /** シークコールバックを登録 */
  registerSeekCallback: (callback: SeekCallback) => void;
  /** アイテム再生コールバックを登録 */
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

  // コールバック登録用のref（再レンダリングを避けるため）
  const seekCallbackRef = React.useRef<SeekCallback | null>(null);
  const playItemCallbackRef = React.useRef<PlayItemCallback | null>(null);

  // コールバック登録関数
  const registerSeekCallback = useCallback((callback: SeekCallback) => {
    seekCallbackRef.current = callback;
  }, []);

  const registerPlayItemCallback = useCallback((callback: PlayItemCallback) => {
    playItemCallbackRef.current = callback;
  }, []);

  // アクティブなプレイリストを取得
  const activePlaylist = useMemo(() => {
    if (!state.activePlaylistId) return null;
    return state.playlists.find((p) => p.id === state.activePlaylistId) ?? null;
  }, [state.playlists, state.activePlaylistId]);

  // 新しいプレイリストを作成
  const createPlaylist = useCallback(
    (name: string, description?: string): Playlist => {
      const now = Date.now();
      const newPlaylist: Playlist = {
        id: uuidv4(),
        name,
        description,
        type: 'reference',
        items: [],
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        playlists: [...prev.playlists, newPlaylist],
        activePlaylistId: newPlaylist.id,
      }));
      return newPlaylist;
    },
    [],
  );

  // プレイリストを削除
  const deletePlaylist = useCallback((playlistId: string) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== playlistId),
      activePlaylistId:
        prev.activePlaylistId === playlistId ? null : prev.activePlaylistId,
    }));
  }, []);

  // プレイリスト名を更新
  const updatePlaylistName = useCallback((playlistId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId ? { ...p, name, updatedAt: Date.now() } : p,
      ),
    }));
  }, []);

  // アクティブなプレイリストを設定
  const setActivePlaylist = useCallback((playlistId: string | null) => {
    setState((prev) => ({ ...prev, activePlaylistId: playlistId }));
  }, []);

  // タイムラインアイテムをプレイリストに追加
  const addItemsFromTimeline = useCallback(
    (
      playlistId: string,
      items: TimelineData[],
      videoPath?: string | null,
      videoPath2?: string | null,
    ) => {
      const now = Date.now();
      const newItems: PlaylistItem[] = items.map((item) => ({
        id: uuidv4(),
        timelineItemId: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        labels: item.labels,
        qualifier: item.qualifier,
        addedAt: now,
        videoSource: videoPath || undefined,
        videoSource2: videoPath2 || undefined,
      }));

      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? { ...p, items: [...p.items, ...newItems], updatedAt: now }
            : p,
        ),
      }));
    },
    [],
  );

  // プレイリストアイテムを削除
  const removeItem = useCallback((playlistId: string, itemId: string) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              items: p.items.filter((item) => item.id !== itemId),
              updatedAt: Date.now(),
            }
          : p,
      ),
      playingItemId: prev.playingItemId === itemId ? null : prev.playingItemId,
    }));
  }, []);

  // プレイリストアイテムの順序を変更
  const reorderItems = useCallback(
    (playlistId: string, fromIndex: number, toIndex: number) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const newItems = [...p.items];
          const [removed] = newItems.splice(fromIndex, 1);
          newItems.splice(toIndex, 0, removed);
          return { ...p, items: newItems, updatedAt: Date.now() };
        }),
      }));
    },
    [],
  );

  // プレイリストアイテムのメモを更新
  const updateItemNote = useCallback(
    (playlistId: string, itemId: string, note: string) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                items: p.items.map((item) =>
                  item.id === itemId ? { ...item, note } : item,
                ),
                updatedAt: Date.now(),
              }
            : p,
        ),
      }));
    },
    [],
  );

  // ループモードを設定
  const setLoopMode = useCallback((mode: 'none' | 'single' | 'all') => {
    setState((prev) => ({ ...prev, loopMode: mode }));
  }, []);

  // 再生中アイテムを設定
  const setPlayingItem = useCallback((itemId: string | null) => {
    setState((prev) => ({ ...prev, playingItemId: itemId }));
  }, []);

  // プレイリストウィンドウを開く
  const openPlaylistWindow = useCallback(async () => {
    if (!window.electronAPI?.playlist) return;
    await window.electronAPI.playlist.openWindow();
    setIsWindowOpen(true);
  }, []);

  // プレイリストウィンドウへ同期
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

  // プレイリストウィンドウからのコマンドを処理
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
            .find((i) => i.id === command.itemId);
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
          // syncToWindowは外部で呼び出す（currentTimeが必要なため）
          break;
      }
    };

    const handleWindowClosed = () => {
      setIsWindowOpen(false);
    };

    window.electronAPI.playlist.onCommand(
      handleCommand as (cmd: unknown) => void,
    );
    window.electronAPI.playlist.onWindowClosed(handleWindowClosed);

    return () => {
      window.electronAPI?.playlist?.offCommand(
        handleCommand as (cmd: unknown) => void,
      );
      window.electronAPI?.playlist?.offWindowClosed(handleWindowClosed);
    };
  }, [state.playlists, setPlayingItem]);

  // ウィンドウ状態の定期確認
  useEffect(() => {
    if (!window.electronAPI?.playlist) return;

    const checkWindowState = async () => {
      const open = await window.electronAPI!.playlist.isWindowOpen();
      setIsWindowOpen(open);
    };

    checkWindowState();
    const interval = setInterval(checkWindowState, 2000);
    return () => clearInterval(interval);
  }, []);

  const value: PlaylistContextValue = {
    state,
    activePlaylist,
    createPlaylist,
    deletePlaylist,
    updatePlaylistName,
    setActivePlaylist,
    addItemsFromTimeline,
    removeItem,
    reorderItems,
    updateItemNote,
    setLoopMode,
    setPlayingItem,
    openPlaylistWindow,
    isWindowOpen,
    syncToWindow,
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
