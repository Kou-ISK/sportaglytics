import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

type TimelineKeyboardShortcutsParams = {
  selectedTimelineIdList: string[];
  deleteTimelineDatas: (idList: string[]) => void;
  setSelectedTimelineIdList: Dispatch<SetStateAction<string[]>>;
  performUndo: () => void;
  performRedo: () => void;
};

export const useTimelineKeyboardShortcuts = ({
  selectedTimelineIdList,
  deleteTimelineDatas,
  setSelectedTimelineIdList,
  performUndo,
  performRedo,
}: TimelineKeyboardShortcutsParams): void => {
  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合は何もしない
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Delete/Backspace: 選択中のタイムラインを削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTimelineIdList.length > 0) {
          e.preventDefault();
          deleteTimelineDatas(selectedTimelineIdList);
          setSelectedTimelineIdList([]);
        }
        return;
      }

      // Cmd+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      // Cmd+Shift+Z: Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
        return;
      }

      // Cmd+Y: Redo（Windows用）
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        performRedo();
        return;
      }
    },
    [
      selectedTimelineIdList,
      deleteTimelineDatas,
      setSelectedTimelineIdList,
      performUndo,
      performRedo,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);
};
