import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import {
  addLayoutLink,
  findTargetButton,
  moveSelectedButtons,
  removeButtonAndRelatedLinks,
  resizeButton,
} from './freeCanvasDragOperations';

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
        onLayoutChange(
          moveSelectedButtons({
            layout,
            draggedButton,
            snapshot: dragSelectionSnapshot.current,
            pointer: position,
            dragOffset,
            gridSize,
          }),
        );
        return;
      }

      if (dragMode === 'resize' && draggedButton && resizeHandle) {
        onLayoutChange(
          resizeButton({
            layout,
            draggedButton,
            pointer: position,
            gridSize,
          }),
        );
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
        const targetButton = findTargetButton({
          layout,
          sourceButtonId: linkStartButton.id,
          pointer: position,
        });

        if (targetButton) {
          const nextLayout = addLayoutLink({
            layout,
            fromButtonId: linkStartButton.id,
            toButtonId: targetButton.id,
            linkType: mapLinkType(linkType),
          });
          if (nextLayout) {
            updateLayoutWithHistory({
              ...nextLayout,
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
      updateLayoutWithHistory(removeButtonAndRelatedLinks({ layout, buttonId }));

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
