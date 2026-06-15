import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/settings/coreTypes';
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
  getCanvasPosition: (event: React.MouseEvent | MouseEvent) => {
    x: number;
    y: number;
  };
}

type RangeSelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  const [rangeSelectionBox, setRangeSelectionBox] =
    useState<RangeSelectionBox | null>(null);
  const rangeSelectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const rangeSelectionBaseRef = useRef<string[]>([]);
  const didRangeSelectRef = useRef(false);

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

  const getRangeSelectionIds = useCallback(
    (box: RangeSelectionBox, baseSelection: string[]): string[] => {
      const selectedIds = layout.buttons
        .filter((button) => {
          const buttonRight = button.x + button.width;
          const buttonBottom = button.y + button.height;
          const boxRight = box.x + box.width;
          const boxBottom = box.y + box.height;
          return (
            button.x < boxRight &&
            buttonRight > box.x &&
            button.y < boxBottom &&
            buttonBottom > box.y
          );
        })
        .map((button) => button.id);

      return Array.from(new Set([...baseSelection, ...selectedIds]));
    },
    [layout.buttons],
  );

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0 || event.target !== canvasRef.current) return;
      event.preventDefault();

      const position = getCanvasPosition(event);
      rangeSelectionStartRef.current = position;
      rangeSelectionBaseRef.current =
        event.metaKey || event.ctrlKey || event.shiftKey
          ? selectedButtonIds
          : [];
      didRangeSelectRef.current = false;
      setRangeSelectionBox({
        x: position.x,
        y: position.y,
        width: 0,
        height: 0,
      });
      onSelectButtons(rangeSelectionBaseRef.current);
      setSelectedLinkId(null);
    },
    [
      canvasRef,
      getCanvasPosition,
      onSelectButtons,
      selectedButtonIds,
      setSelectedLinkId,
    ],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const start = rangeSelectionStartRef.current;
      if (start) {
        const position = getCanvasPosition(event);
        const box = {
          x: Math.min(start.x, position.x),
          y: Math.min(start.y, position.y),
          width: Math.abs(position.x - start.x),
          height: Math.abs(position.y - start.y),
        };
        setRangeSelectionBox(box);
        if (box.width > 3 || box.height > 3) {
          didRangeSelectRef.current = true;
        }
        onSelectButtons(getRangeSelectionIds(box, rangeSelectionBaseRef.current));
        return;
      }

      pointerHandlers.handleMouseMove(event);
    },
    [getCanvasPosition, getRangeSelectionIds, onSelectButtons, pointerHandlers],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (rangeSelectionStartRef.current) {
        rangeSelectionStartRef.current = null;
        rangeSelectionBaseRef.current = [];
        setRangeSelectionBox(null);
        return;
      }

      pointerHandlers.handleMouseUp(event);
    },
    [pointerHandlers],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if (didRangeSelectRef.current) {
        event.preventDefault();
        didRangeSelectRef.current = false;
        return;
      }

      pointerHandlers.handleCanvasClick(event);
    },
    [pointerHandlers],
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!rangeSelectionStartRef.current) return;
      rangeSelectionStartRef.current = null;
      rangeSelectionBaseRef.current = [];
      setRangeSelectionBox(null);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return {
    dragMode: dragState.dragMode,
    draggedButton: dragState.draggedButton,
    linkEndPos: dragState.linkEndPos,
    linkStartButton: dragState.linkStartButton,
    linkType: dragState.linkType,
    rangeSelectionBox,
    handleButtonMouseDown,
    handleButtonRightMouseDown,
    handleCanvasMouseDown,
    handleCanvasClick,
    handleDeleteButton: pointerHandlers.handleDeleteButton,
    handleMouseMove,
    handleMouseUp,
    handleSelectLink: pointerHandlers.handleSelectLink,
  };
};
