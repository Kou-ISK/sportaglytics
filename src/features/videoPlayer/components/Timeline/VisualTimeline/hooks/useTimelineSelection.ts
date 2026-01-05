import { useCallback, useState } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';

interface UseTimelineSelectionParams {
  timeline: TimelineData[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSeek: (time: number) => void;
}

export const useTimelineSelection = ({
  timeline,
  selectedIds,
  onSelectionChange,
  onSeek,
}: UseTimelineSelectionParams) => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  const handleItemClick = useCallback(
    (event: React.MouseEvent, id: string) => {
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

      // 単独選択 + シーク
      const item = timeline.find((entry) => entry.id === id);
      if (!item) return;
      onSelectionChange([id]);
      setFocusedItemId(id);
      onSeek(item.startTime);
    },
    [onSeek, onSelectionChange, selectedIds, timeline],
  );

  return {
    hoveredItemId,
    setHoveredItemId,
    focusedItemId,
    setFocusedItemId,
    handleItemClick,
  };
};
