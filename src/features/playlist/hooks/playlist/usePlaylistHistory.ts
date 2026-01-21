import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistItem } from '../../../../types/Playlist';

interface PlaylistHistoryState {
  past: PlaylistItem[][];
  present: PlaylistItem[];
  future: PlaylistItem[][];
}

interface UsePlaylistHistoryReturn {
  items: PlaylistItem[];
  canUndo: boolean;
  canRedo: boolean;
  setItems: (
    items: PlaylistItem[] | ((prev: PlaylistItem[]) => PlaylistItem[]),
  ) => void;
  undo: () => PlaylistItem[] | null;
  redo: () => PlaylistItem[] | null;
  clearHistory: () => void;
}

const MAX_HISTORY_SIZE = 50;

/**
 * プレイリストアイテムの履歴管理Hook
 * 並び替え、削除、メモ編集、描画追加、フリーズ時間変更などの操作に対応
 */
export function usePlaylistHistory(
  initialItems: PlaylistItem[] = [],
): UsePlaylistHistoryReturn {
  const [state, setState] = useState<PlaylistHistoryState>({
    past: [],
    present: initialItems,
    future: [],
  });

  // 初回マウントフラグ（ファイル読み込み時のみ履歴をリセット）
  const isInitialMount = useRef(true);
  // 前回のinitialItemsを保持（無限ループを防ぐため）
  const prevInitialItemsJSON = useRef<string>(JSON.stringify(initialItems));

  // 外部からのアイテム更新を検知（ファイル読み込み時など）
  useEffect(() => {
    const newJSON = JSON.stringify(initialItems);

    // initialItemsが変更された場合
    if (prevInitialItemsJSON.current !== newJSON) {
      // 初回マウント時、または現在のpresentと異なる場合のみ履歴をリセット
      const currentPresentJSON = JSON.stringify(state.present);
      if (isInitialMount.current || newJSON !== currentPresentJSON) {
        setState({
          past: [],
          present: initialItems,
          future: [],
        });
      }
      prevInitialItemsJSON.current = newJSON;
      isInitialMount.current = false;
    }
  }, [initialItems, state.present]);

  const setItems = useCallback(
    (items: PlaylistItem[] | ((prev: PlaylistItem[]) => PlaylistItem[])) => {
      setState((prev) => {
        const newItems =
          typeof items === 'function' ? items(prev.present) : items;
        const newPast = [...prev.past, prev.present].slice(-MAX_HISTORY_SIZE);
        return {
          past: newPast,
          present: newItems,
          future: [], // 新しい変更を加えたらfutureはクリア
        };
      });
    },
    [],
  );

  const undo = useCallback((): PlaylistItem[] | null => {
    let result: PlaylistItem[] | null = null;

    setState((prev) => {
      if (prev.past.length === 0) {
        return prev;
      }

      const previous = prev.past.at(-1);
      if (!previous) return prev;

      const newPast = prev.past.slice(0, -1);

      result = previous;

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });

    return result;
  }, []);

  const redo = useCallback((): PlaylistItem[] | null => {
    let result: PlaylistItem[] | null = null;

    setState((prev) => {
      if (prev.future.length === 0) {
        return prev;
      }

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      result = next;

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });

    return result;
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }));
  }, []);

  return {
    items: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setItems,
    undo,
    redo,
    clearHistory,
  };
}
