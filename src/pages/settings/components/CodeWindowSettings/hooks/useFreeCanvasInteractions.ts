import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import {
  createButtonLink,
  DEFAULT_BUTTON_HEIGHT,
  DEFAULT_BUTTON_WIDTH,
  snapToGrid,
} from '../utils';

type DragMode = 'move' | 'resize' | 'link' | null;
type LinkType = 'exclusive' | 'lead' | 'deactivate';

interface UseFreeCanvasInteractionsParams {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  gridSize: number;
  layout: CodeWindowLayout;
  selectedButtonIds: string[];
  onLayoutChange: (layout: CodeWindowLayout) => void;
  onSelectButtons: (ids: string[]) => void;
  setSelectedLinkId: (linkId: string | null) => void;
  updateLayoutWithHistory: (layout: CodeWindowLayout) => void;
  getCanvasPosition: (
    event: React.MouseEvent | MouseEvent,
  ) => { x: number; y: number };
}

const getLinkTypeFromEvent = (event: React.MouseEvent): LinkType => {
  if (event.altKey) return 'lead';
  if (event.shiftKey) return 'deactivate';
  return 'exclusive';
};

const mapLinkType = (linkType: LinkType): 'exclusive' | 'activate' | 'deactivate' => {
  if (linkType === 'lead') return 'activate';
  if (linkType === 'deactivate') return 'deactivate';
  return 'exclusive';
};

const resetSelectionSnapshot = (
  layout: CodeWindowLayout,
  selection: string[],
): Record<string, { x: number; y: number }> => {
  const snapshot: Record<string, { x: number; y: number }> = {};
  layout.buttons.forEach((button) => {
    if (selection.includes(button.id)) {
      snapshot[button.id] = { x: button.x, y: button.y };
    }
  });
  return snapshot;
};

export const useFreeCanvasInteractions = ({
  canvasRef,
  gridSize,
  layout,
  selectedButtonIds,
  onLayoutChange,
  onSelectButtons,
  setSelectedLinkId,
  updateLayoutWithHistory,
  getCanvasPosition,
}: UseFreeCanvasInteractionsParams) => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [draggedButton, setDraggedButton] = useState<CodeWindowButton | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linkStartButton, setLinkStartButton] =
    useState<CodeWindowButton | null>(null);
  const [linkEndPos, setLinkEndPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [linkType, setLinkType] = useState<LinkType>('exclusive');
  const [resizeHandle, setResizeHandle] = useState<'se' | 'e' | 's' | null>(
    null,
  );
  const dragSelectionSnapshot = useRef<
    Record<string, { x: number; y: number }>
  >({});

  const resetDragState = useCallback(() => {
    setDragMode(null);
    setDraggedButton(null);
    setLinkStartButton(null);
    setLinkEndPos(null);
    setResizeHandle(null);
    setLinkType('exclusive');
  }, []);

  const applySelection = useCallback(
    (id: string, additive: boolean) => {
      if (!additive) {
        onSelectButtons([id]);
        return [id];
      }
      const exists = selectedButtonIds.includes(id);
      const next = exists
        ? selectedButtonIds.filter((value) => value !== id)
        : [...selectedButtonIds, id];
      onSelectButtons(next);
      return next;
    },
    [onSelectButtons, selectedButtonIds],
  );

  const handleButtonRightMouseDown = useCallback(
    (event: React.MouseEvent, button: CodeWindowButton) => {
      if (event.button !== 2) return;
      event.preventDefault();
      event.stopPropagation();

      setLinkType(getLinkTypeFromEvent(event));
      setLinkStartButton(button);
      setDragMode('link');
      setLinkEndPos(getCanvasPosition(event));
      applySelection(
        button.id,
        event.metaKey || event.ctrlKey || event.shiftKey,
      );
    },
    [applySelection, getCanvasPosition],
  );

  const handleButtonMouseDown = useCallback(
    (
      event: React.MouseEvent,
      button: CodeWindowButton,
      mode: DragMode = 'move',
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (mode === 'link') {
        setLinkStartButton(button);
        setDragMode('link');
        setLinkEndPos(getCanvasPosition(event));
      } else {
        const position = getCanvasPosition(event);
        setDraggedButton(button);
        setDragOffset({ x: position.x - button.x, y: position.y - button.y });
        setDragMode(mode);
        if (mode === 'resize') {
          setResizeHandle('se');
        }
      }

      const nextSelection = applySelection(
        button.id,
        event.metaKey || event.ctrlKey || event.shiftKey,
      );
      dragSelectionSnapshot.current = resetSelectionSnapshot(layout, nextSelection);
      setSelectedLinkId(null);
    },
    [applySelection, getCanvasPosition, layout, setSelectedLinkId],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const position = getCanvasPosition(event);

      if (dragMode === 'move' && draggedButton) {
        const primaryStart = dragSelectionSnapshot.current[draggedButton.id] ?? {
          x: draggedButton.x,
          y: draggedButton.y,
        };
        const targetX = snapToGrid(position.x - dragOffset.x, gridSize);
        const targetY = snapToGrid(position.y - dragOffset.y, gridSize);
        const deltaX = targetX - primaryStart.x;
        const deltaY = targetY - primaryStart.y;

        const updatedButtons = layout.buttons.map((button) => {
          const startPos = dragSelectionSnapshot.current[button.id];
          if (!startPos) return button;
          const nextX = Math.max(
            0,
            Math.min(layout.canvasWidth - button.width, startPos.x + deltaX),
          );
          const nextY = Math.max(
            0,
            Math.min(layout.canvasHeight - button.height, startPos.y + deltaY),
          );
          return { ...button, x: nextX, y: nextY };
        });
        onLayoutChange({ ...layout, buttons: updatedButtons });
        return;
      }

      if (dragMode === 'resize' && draggedButton && resizeHandle) {
        const newWidth = snapToGrid(
          Math.max(DEFAULT_BUTTON_WIDTH / 2, position.x - draggedButton.x),
          gridSize,
        );
        const newHeight = snapToGrid(
          Math.max(DEFAULT_BUTTON_HEIGHT / 2, position.y - draggedButton.y),
          gridSize,
        );
        const updatedButtons = layout.buttons.map((button) =>
          button.id === draggedButton.id
            ? { ...button, width: newWidth, height: newHeight }
            : button,
        );
        onLayoutChange({ ...layout, buttons: updatedButtons });
        return;
      }

      if (dragMode === 'link' && linkStartButton) {
        setLinkEndPos(position);
      }
    },
    [
      dragMode,
      dragOffset.x,
      dragOffset.y,
      draggedButton,
      getCanvasPosition,
      gridSize,
      layout,
      linkStartButton,
      onLayoutChange,
      resizeHandle,
    ],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (dragMode === 'link' && linkStartButton) {
        const position = getCanvasPosition(event);
        const targetButton = layout.buttons.find((button) => {
          return (
            button.id !== linkStartButton.id &&
            position.x >= button.x &&
            position.x <= button.x + button.width &&
            position.y >= button.y &&
            position.y <= button.y + button.height
          );
        });

        if (targetButton) {
          const existingLink = layout.buttonLinks?.find(
            (link) =>
              (link.fromButtonId === linkStartButton.id &&
                link.toButtonId === targetButton.id) ||
              (link.fromButtonId === targetButton.id &&
                link.toButtonId === linkStartButton.id),
          );

          if (!existingLink) {
            const newLink = createButtonLink(
              linkStartButton.id,
              targetButton.id,
              mapLinkType(linkType),
            );
            updateLayoutWithHistory({
              ...layout,
              buttonLinks: [...(layout.buttonLinks || []), newLink],
            });
          }
        }
      } else if (
        (dragMode === 'move' || dragMode === 'resize') &&
        draggedButton
      ) {
        updateLayoutWithHistory(layout);
      }

      resetDragState();
    },
    [
      dragMode,
      draggedButton,
      getCanvasPosition,
      layout,
      linkStartButton,
      linkType,
      resetDragState,
      updateLayoutWithHistory,
    ],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target !== canvasRef.current) return;
      onSelectButtons([]);
      setSelectedLinkId(null);
    },
    [canvasRef, onSelectButtons, setSelectedLinkId],
  );

  const handleDeleteButton = useCallback(
    (buttonId: string) => {
      updateLayoutWithHistory({
        ...layout,
        buttons: layout.buttons.filter((button) => button.id !== buttonId),
        buttonLinks: layout.buttonLinks?.filter(
          (link) => link.fromButtonId !== buttonId && link.toButtonId !== buttonId,
        ),
      });

      if (!selectedButtonIds.includes(buttonId)) return;
      onSelectButtons(selectedButtonIds.filter((id) => id !== buttonId));
    },
    [
      layout,
      onSelectButtons,
      selectedButtonIds,
      updateLayoutWithHistory,
    ],
  );

  const handleSelectLink = useCallback(
    (linkId: string) => {
      setSelectedLinkId(linkId);
      onSelectButtons([]);
    },
    [onSelectButtons, setSelectedLinkId],
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!dragMode) return;
      resetDragState();
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragMode, resetDragState]);

  return {
    dragMode,
    draggedButton,
    linkEndPos,
    linkStartButton,
    linkType,
    handleButtonMouseDown,
    handleButtonRightMouseDown,
    handleCanvasClick,
    handleDeleteButton,
    handleMouseMove,
    handleMouseUp,
    handleSelectLink,
  };
};
