import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistItem, PlaylistRow } from '../../../../types/playlist/core';
import {
  playlistMediaContentKey,
  reconcilePlaylistMedia,
} from '../../../../shared/playlist/playlistMediaReconciliation';

interface DocumentSnapshot {
  items: PlaylistItem[];
  rows?: PlaylistRow[];
}

interface PlaylistHistoryState {
  past: DocumentSnapshot[];
  present: PlaylistItem[];
  future: DocumentSnapshot[];
}

interface UsePlaylistHistoryReturn {
  items: PlaylistItem[];
  setDocument: (items: PlaylistItem[], rows: PlaylistRow[]) => void;
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
  ) => 'unchanged' | 'derived' | 'changed';
}

const MAX_HISTORY_SIZE = 50;

/**
 * プレイリストアイテムの履歴管理Hook
 * 並び替え、削除、メモ編集、描画追加、フリーズ時間変更などの操作に対応
 */
export function usePlaylistHistory(
  initialItems: PlaylistItem[] = [],
  getRows?: () => PlaylistRow[],
  restoreRows?: (rows: PlaylistRow[]) => void,
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

  const saveEdit = useCallback((present: PlaylistItem[], rows?: PlaylistRow[]): void => {
    const previous = stateRef.current;
    const previousRows = getRows?.();
    if (present === previous.present && (!rows || rows === previousRows)) return;
    if (rows) restoreRows?.(rows);
    commit({
      past: [...previous.past, { items: previous.present, rows: previousRows }].slice(-MAX_HISTORY_SIZE),
      present,
      future: [],
    });
  }, [commit, getRows, restoreRows]);

  const setItems = useCallback(
    (
      update: PlaylistItem[] | ((prev: PlaylistItem[]) => PlaylistItem[]),
    ): void => {
      const previous = stateRef.current;
      const present =
        typeof update === 'function' ? update(previous.present) : update;
      saveEdit(present);
    },
    [saveEdit],
  );
  const undo = useCallback((): PlaylistItem[] | null => {
    const previous = stateRef.current;
    const present = previous.past.at(-1);
    if (!present) return null;
    const rows = getRows?.();
    if (present.rows) restoreRows?.(present.rows);
    commit({
      past: previous.past.slice(0, -1),
      present: present.items,
      future: [{ items: previous.present, rows }, ...previous.future],
    });
    return present.items;
  }, [commit, getRows, restoreRows]);
  const redo = useCallback((): PlaylistItem[] | null => {
    const previous = stateRef.current;
    const present = previous.future[0];
    if (!present) return null;
    const rows = getRows?.();
    if (present.rows) restoreRows?.(present.rows);
    commit({
      past: [...previous.past, { items: previous.present, rows }],
      present: present.items,
      future: previous.future.slice(1),
    });
    return present.items;
  }, [commit, getRows, restoreRows]);
  const clearHistory = useCallback((): void => {
    commit({ past: [], present: stateRef.current.present, future: [] });
  }, [commit]);

  const reconcileMedia = useCallback(
    (
      requested: PlaylistItem[],
      resolved: PlaylistItem[],
    ): 'unchanged' | 'derived' | 'changed' => {
      const previous = stateRef.current;
      const reconcile = (items: PlaylistItem[]): PlaylistItem[] =>
        reconcilePlaylistMedia(items, requested, resolved);
      const present = reconcile(previous.present);
      if (present === previous.present) return 'unchanged';
      const changed = present.some(
        (item, index) =>
          playlistMediaContentKey(item) !==
          playlistMediaContentKey(previous.present[index]),
      );
      commit({
        past: previous.past.map((entry) => ({ ...entry, items: reconcile(entry.items) })),
        present,
        future: previous.future.map((entry) => ({ ...entry, items: reconcile(entry.items) })),
      });
      return changed ? 'changed' : 'derived';
    },
    [commit],
  );

  return {
    items: state.present,
    setDocument: saveEdit,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setItems,
    undo,
    redo,
    clearHistory,
    reconcileMedia,
  };
}
