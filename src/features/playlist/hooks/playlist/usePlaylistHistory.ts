import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistItem } from '../../../../types/playlist/core';
import { reconcilePlaylistMedia } from '../../../../shared/playlist/playlistMediaReconciliation';

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
  reconcileMedia: (
    requested: PlaylistItem[],
    resolved: PlaylistItem[],
  ) => boolean;
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

  const stateRef = useRef(state);
  const previousInput = useRef(JSON.stringify(initialItems));
  const commit = useCallback((next: PlaylistHistoryState): void => {
    stateRef.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    const serialized = JSON.stringify(initialItems);
    if (previousInput.current === serialized) return;
    previousInput.current = serialized;
    if (serialized !== JSON.stringify(stateRef.current.present)) {
      commit({ past: [], present: initialItems, future: [] });
    }
  }, [initialItems, commit]);

  const setItems = useCallback(
    (
      update: PlaylistItem[] | ((prev: PlaylistItem[]) => PlaylistItem[]),
    ): void => {
      const previous = stateRef.current;
      const present =
        typeof update === 'function' ? update(previous.present) : update;
      if (present === previous.present) return;
      commit({
        past: [...previous.past, previous.present].slice(-MAX_HISTORY_SIZE),
        present,
        future: [],
      });
    },
    [commit],
  );
  const undo = useCallback((): PlaylistItem[] | null => {
    const previous = stateRef.current;
    const present = previous.past.at(-1);
    if (!present) return null;
    commit({
      past: previous.past.slice(0, -1),
      present,
      future: [previous.present, ...previous.future],
    });
    return present;
  }, [commit]);
  const redo = useCallback((): PlaylistItem[] | null => {
    const previous = stateRef.current;
    const present = previous.future[0];
    if (!present) return null;
    commit({
      past: [...previous.past, previous.present],
      present,
      future: previous.future.slice(1),
    });
    return present;
  }, [commit]);
  const clearHistory = useCallback((): void => {
    commit({ past: [], present: stateRef.current.present, future: [] });
  }, [commit]);

  const reconcileMedia = useCallback(
    (requested: PlaylistItem[], resolved: PlaylistItem[]): boolean => {
      const previous = stateRef.current;
      const reconcile = (items: PlaylistItem[]): PlaylistItem[] =>
        reconcilePlaylistMedia(items, requested, resolved);
      const present = reconcile(previous.present);
      if (present === previous.present) return false;
      commit({
        past: previous.past.map(reconcile),
        present,
        future: previous.future.map(reconcile),
      });
      return true;
    },
    [commit],
  );

  return {
    items: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setItems,
    undo,
    redo,
    clearHistory,
    reconcileMedia,
  };
}
