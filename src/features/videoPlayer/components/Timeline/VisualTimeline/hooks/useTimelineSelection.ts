import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction, MouseEvent } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';

interface UseTimelineSelectionParams {
  timeline: TimelineData[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

interface TimelineSelectionState {
  hoveredItemId: string | null;
  setHoveredItemId: Dispatch<SetStateAction<string | null>>;
  focusedItemId: string | null;
  setFocusedItemId: Dispatch<SetStateAction<string | null>>;
  handleItemClick: (event: MouseEvent, id: string) => void;
}

export const useTimelineSelection = ({
  timeline,
  selectedIds,
  onSelectionChange,
}: UseTimelineSelectionParams): TimelineSelectionState => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  const handleItemClick = useCallback(
    (event: MouseEvent, id: string): void => {
      event.stopPropagation();

      // 複数選択（Shift/Ctrl/Cmd）
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        if (selectedIds.includes(id)) {
          onSelectionChange(
            selectedIds.filter((selectedId) => selectedId !== id),
          );
        } else {
          onSelectionChange([...selectedIds, id]);
        }
        setFocusedItemId(id);
        return;
      }

      // 単独選択。再生位置の操作は上部目盛り・つまみまたは明示的なジャンプに限定する。
      const item = timeline.find((entry) => entry.id === id);
      if (!item) return;
      onSelectionChange([id]);
      setFocusedItemId(id);
    },
    [onSelectionChange, selectedIds, timeline],
  );

  return {
    hoveredItemId,
    setHoveredItemId,
    focusedItemId,
    setFocusedItemId,
    handleItemClick,
  };
};
