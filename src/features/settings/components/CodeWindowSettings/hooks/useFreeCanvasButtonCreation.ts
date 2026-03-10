import { useCallback, useState } from 'react';
import type { CodeWindowLayout } from '../../../../../types/Settings';
import {
  canPlaceButton,
  createButton,
  findEmptySpace,
  snapToGrid,
} from '../utils';

interface UseFreeCanvasButtonCreationParams {
  layout: CodeWindowLayout;
  onSelectButtons: (ids: string[]) => void;
  updateLayoutWithHistory: (layout: CodeWindowLayout) => void;
  getCanvasPosition: (event: React.MouseEvent | MouseEvent) => { x: number; y: number };
  gridSize: number;
}

export const useFreeCanvasButtonCreation = ({
  layout,
  onSelectButtons,
  updateLayoutWithHistory,
  getCanvasPosition,
  gridSize,
}: UseFreeCanvasButtonCreationParams) => {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    position: { x: number; y: number };
  } | null>(null);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [customLabelDialogOpen, setCustomLabelDialogOpen] = useState(false);
  const [customLabelGroup, setCustomLabelGroup] = useState('');
  const [customLabelValue, setCustomLabelValue] = useState('');
  const [customActionDialogOpen, setCustomActionDialogOpen] = useState(false);
  const [customActionName, setCustomActionName] = useState('');

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const pos = getCanvasPosition(event);
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
        position: {
          x: snapToGrid(pos.x, gridSize),
          y: snapToGrid(pos.y, gridSize),
        },
      });
    },
    [getCanvasPosition, gridSize],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const addButtonAt = useCallback(
    (
      type: 'action' | 'label',
      name: string,
      x: number,
      y: number,
      labelValue?: string,
    ) => {
      let newButton = createButton(type, name, x, y, { labelValue });

      const canPlaceAtTarget = canPlaceButton(
        layout.buttons,
        newButton,
        newButton.x,
        newButton.y,
        layout.canvasWidth,
        layout.canvasHeight,
      );

      if (!canPlaceAtTarget) {
        const fallback = findEmptySpace(
          layout.buttons,
          newButton.width,
          newButton.height,
          layout.canvasWidth,
          layout.canvasHeight,
        );
        if (fallback) {
          newButton = { ...newButton, x: fallback.x, y: fallback.y };
        } else {
          return null;
        }
      }

      updateLayoutWithHistory({
        ...layout,
        buttons: [...layout.buttons, newButton],
      });
      onSelectButtons([newButton.id]);
      return newButton.id;
    },
    [layout, onSelectButtons, updateLayoutWithHistory],
  );

  const handleAddButton = useCallback(
    (type: 'action' | 'label', name: string, labelValue?: string) => {
      if (!contextMenu) return;
      const created = addButtonAt(
        type,
        name,
        contextMenu.position.x,
        contextMenu.position.y,
        labelValue,
      );
      if (created) {
        handleCloseContextMenu();
      }
    },
    [addButtonAt, contextMenu, handleCloseContextMenu],
  );

  const handleOpenCustomActionDialog = useCallback(
    (position: { x: number; y: number }) => {
      setDialogPosition(position);
      setCustomActionDialogOpen(true);
    },
    [],
  );

  const handleOpenCustomLabelDialog = useCallback(
    (position: { x: number; y: number }) => {
      setDialogPosition(position);
      setCustomLabelDialogOpen(true);
    },
    [],
  );

  const handleConfirmCustomAction = useCallback(() => {
    if (!customActionName.trim()) return;
    const created = addButtonAt(
      'action',
      customActionName.trim(),
      dialogPosition.x,
      dialogPosition.y,
    );
    if (!created) return;
    setCustomActionName('');
    setCustomActionDialogOpen(false);
  }, [addButtonAt, customActionName, dialogPosition.x, dialogPosition.y]);

  const handleConfirmCustomLabel = useCallback(() => {
    if (!customLabelGroup.trim() || !customLabelValue.trim()) return;
    const created = addButtonAt(
      'label',
      customLabelGroup.trim(),
      dialogPosition.x,
      dialogPosition.y,
      customLabelValue.trim(),
    );
    if (!created) return;
    setCustomLabelGroup('');
    setCustomLabelValue('');
    setCustomLabelDialogOpen(false);
  }, [
    addButtonAt,
    customLabelGroup,
    customLabelValue,
    dialogPosition.x,
    dialogPosition.y,
  ]);

  return {
    contextMenu,
    customActionDialogOpen,
    customActionName,
    customLabelDialogOpen,
    customLabelGroup,
    customLabelValue,
    setCustomActionDialogOpen,
    setCustomActionName,
    setCustomLabelDialogOpen,
    setCustomLabelGroup,
    setCustomLabelValue,
    handleContextMenu,
    handleCloseContextMenu,
    handleAddButton,
    handleOpenCustomActionDialog,
    handleOpenCustomLabelDialog,
    handleConfirmCustomAction,
    handleConfirmCustomLabel,
  };
};
