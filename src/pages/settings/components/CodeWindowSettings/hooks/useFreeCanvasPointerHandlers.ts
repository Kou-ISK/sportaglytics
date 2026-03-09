import { useCallback, useEffect } from 'react';
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
import type {
  FreeCanvasDragMode,
  FreeCanvasLinkType,
} from './useFreeCanvasDragState';

interface UseFreeCanvasPointerHandlersParams {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  layout: CodeWindowLayout;
  gridSize: number;
  selectedButtonIds: string[];
  dragMode: FreeCanvasDragMode;
  draggedButton: CodeWindowButton | null;
  dragOffset: { x: number; y: number };
  resizeHandle: 'se' | 'e' | 's' | null;
  linkStartButton: CodeWindowButton | null;
  linkType: FreeCanvasLinkType;
  dragSelectionSnapshot: React.MutableRefObject<
    Record<string, { x: number; y: number }>
  >;
  setLinkEndPos: (position: { x: number; y: number }) => void;
  resetDragState: () => void;
  onLayoutChange: (nextLayout: CodeWindowLayout) => void;
  onSelectButtons: (ids: string[]) => void;
  setSelectedLinkId: (linkId: string | null) => void;
  updateLayoutWithHistory: (layout: CodeWindowLayout) => void;
  getCanvasPosition: (
    event: React.MouseEvent | MouseEvent,
  ) => { x: number; y: number };
}

const mapLinkType = (
  linkType: FreeCanvasLinkType,
): 'exclusive' | 'activate' | 'deactivate' => {
  if (linkType === 'lead') return 'activate';
  if (linkType === 'deactivate') return 'deactivate';
  return 'exclusive';
};

export const useFreeCanvasPointerHandlers = ({
  canvasRef,
  layout,
  gridSize,
  selectedButtonIds,
  dragMode,
  draggedButton,
  dragOffset,
  resizeHandle,
  linkStartButton,
  linkType,
  dragSelectionSnapshot,
  setLinkEndPos,
  resetDragState,
  onLayoutChange,
  onSelectButtons,
  setSelectedLinkId,
  updateLayoutWithHistory,
  getCanvasPosition,
}: UseFreeCanvasPointerHandlersParams) => {
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
      dragOffset,
      draggedButton,
      getCanvasPosition,
      gridSize,
      layout,
      linkStartButton,
      onLayoutChange,
      resizeHandle,
      setLinkEndPos,
      dragSelectionSnapshot,
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
            updateLayoutWithHistory(nextLayout);
          }
        }
      } else if ((dragMode === 'move' || dragMode === 'resize') && draggedButton) {
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
    [layout, onSelectButtons, selectedButtonIds, updateLayoutWithHistory],
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
    handleMouseMove,
    handleMouseUp,
    handleCanvasClick,
    handleDeleteButton,
    handleSelectLink,
  };
};
