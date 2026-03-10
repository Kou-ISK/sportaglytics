import { useCallback } from 'react';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import {
  type FreeCanvasDragMode,
  useFreeCanvasDragState,
} from './useFreeCanvasDragState';
import { useFreeCanvasPointerHandlers } from './useFreeCanvasPointerHandlers';

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

const getLinkTypeFromEvent = (
  event: React.MouseEvent,
): 'exclusive' | 'lead' | 'deactivate' => {
  if (event.altKey) return 'lead';
  if (event.shiftKey) return 'deactivate';
  return 'exclusive';
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
  const dragState = useFreeCanvasDragState({
    layout,
    selectedButtonIds,
    onSelectButtons,
    getCanvasPosition,
  });

  const pointerHandlers = useFreeCanvasPointerHandlers({
    canvasRef,
    layout,
    gridSize,
    selectedButtonIds,
    dragMode: dragState.dragMode,
    draggedButton: dragState.draggedButton,
    dragOffset: dragState.dragOffset,
    resizeHandle: dragState.resizeHandle,
    linkStartButton: dragState.linkStartButton,
    linkType: dragState.linkType,
    dragSelectionSnapshot: dragState.dragSelectionSnapshot,
    setLinkEndPos: dragState.setLinkEndPos,
    resetDragState: dragState.resetDragState,
    onLayoutChange,
    onSelectButtons,
    setSelectedLinkId,
    updateLayoutWithHistory,
    getCanvasPosition,
  });

  const handleButtonRightMouseDown = useCallback(
    (event: React.MouseEvent, button: CodeWindowButton) => {
      if (event.button !== 2) return;
      event.preventDefault();
      event.stopPropagation();

      dragState.beginLinkDrag(event, button, getLinkTypeFromEvent(event));
    },
    [dragState],
  );

  const handleButtonMouseDown = useCallback(
    (
      event: React.MouseEvent,
      button: CodeWindowButton,
      mode: FreeCanvasDragMode = 'move',
    ) => {
      event.preventDefault();
      event.stopPropagation();
      dragState.beginButtonDrag(event, button, mode);
      setSelectedLinkId(null);
    },
    [dragState, setSelectedLinkId],
  );

  return {
    dragMode: dragState.dragMode,
    draggedButton: dragState.draggedButton,
    linkEndPos: dragState.linkEndPos,
    linkStartButton: dragState.linkStartButton,
    linkType: dragState.linkType,
    handleButtonMouseDown,
    handleButtonRightMouseDown,
    handleCanvasClick: pointerHandlers.handleCanvasClick,
    handleDeleteButton: pointerHandlers.handleDeleteButton,
    handleMouseMove: pointerHandlers.handleMouseMove,
    handleMouseUp: pointerHandlers.handleMouseUp,
    handleSelectLink: pointerHandlers.handleSelectLink,
  };
};
