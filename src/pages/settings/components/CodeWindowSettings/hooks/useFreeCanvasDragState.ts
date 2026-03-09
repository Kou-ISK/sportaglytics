import { useCallback, useRef, useState } from 'react';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';

export type FreeCanvasDragMode = 'move' | 'resize' | 'link' | null;
export type FreeCanvasLinkType = 'exclusive' | 'lead' | 'deactivate';

interface UseFreeCanvasDragStateParams {
  layout: CodeWindowLayout;
  selectedButtonIds: string[];
  onSelectButtons: (ids: string[]) => void;
  getCanvasPosition: (
    event: React.MouseEvent | MouseEvent,
  ) => { x: number; y: number };
}

const snapshotSelectedButtons = (
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

const applySelection = ({
  id,
  additive,
  selectedButtonIds,
  onSelectButtons,
}: {
  id: string;
  additive: boolean;
  selectedButtonIds: string[];
  onSelectButtons: (ids: string[]) => void;
}) => {
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
};

export const useFreeCanvasDragState = ({
  layout,
  selectedButtonIds,
  onSelectButtons,
  getCanvasPosition,
}: UseFreeCanvasDragStateParams) => {
  const [dragMode, setDragMode] = useState<FreeCanvasDragMode>(null);
  const [draggedButton, setDraggedButton] = useState<CodeWindowButton | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linkStartButton, setLinkStartButton] =
    useState<CodeWindowButton | null>(null);
  const [linkEndPos, setLinkEndPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [linkType, setLinkType] = useState<FreeCanvasLinkType>('exclusive');
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

  const applySelectionForButton = useCallback(
    (id: string, additive: boolean) => {
      return applySelection({
        id,
        additive,
        selectedButtonIds,
        onSelectButtons,
      });
    },
    [onSelectButtons, selectedButtonIds],
  );

  const beginLinkDrag = useCallback(
    (
      event: React.MouseEvent,
      button: CodeWindowButton,
      nextLinkType: FreeCanvasLinkType,
    ) => {
      setLinkType(nextLinkType);
      setLinkStartButton(button);
      setDragMode('link');
      setLinkEndPos(getCanvasPosition(event));
      applySelectionForButton(
        button.id,
        event.metaKey || event.ctrlKey || event.shiftKey,
      );
    },
    [applySelectionForButton, getCanvasPosition],
  );

  const beginButtonDrag = useCallback(
    (
      event: React.MouseEvent,
      button: CodeWindowButton,
      mode: FreeCanvasDragMode,
    ) => {
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

      const nextSelection = applySelectionForButton(
        button.id,
        event.metaKey || event.ctrlKey || event.shiftKey,
      );
      dragSelectionSnapshot.current = snapshotSelectedButtons(layout, nextSelection);
    },
    [applySelectionForButton, getCanvasPosition, layout],
  );

  return {
    dragMode,
    draggedButton,
    dragOffset,
    linkStartButton,
    linkEndPos,
    linkType,
    resizeHandle,
    dragSelectionSnapshot,
    resetDragState,
    beginLinkDrag,
    beginButtonDrag,
    setLinkEndPos,
    setLinkType,
  };
};
