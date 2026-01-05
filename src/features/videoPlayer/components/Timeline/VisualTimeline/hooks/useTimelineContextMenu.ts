import { useCallback, useState } from 'react';

interface ContextMenuState {
  position: { top: number; left: number };
  itemId: string;
}

interface UseTimelineContextMenuParams {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export const useTimelineContextMenu = ({
  selectedIds,
  onSelectionChange,
}: UseTimelineContextMenuParams) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleItemContextMenu = useCallback(
    (event: React.MouseEvent, id: string) => {
      // 左クリック等ではメニューを出さない
      if (event.button !== 2) return;

      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        position: { top: event.clientY, left: event.clientX },
        itemId: id,
      });

      if (!selectedIds.includes(id)) {
        onSelectionChange([id]);
      }
    },
    [selectedIds, onSelectionChange],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    setContextMenu,
    handleItemContextMenu,
    handleCloseContextMenu,
  };
};
