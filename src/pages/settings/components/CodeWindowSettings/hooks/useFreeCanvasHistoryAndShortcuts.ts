import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeWindowButton, CodeWindowLayout } from '../../../../../types/Settings';
import { createButton } from '../utils';

interface UseFreeCanvasHistoryAndShortcutsParams {
  layout: CodeWindowLayout;
  selectedButtonIds: string[];
  selectedPrimaryId: string | null;
  onLayoutChange: (layout: CodeWindowLayout) => void;
  onSelectButtons: (ids: string[]) => void;
}

export const useFreeCanvasHistoryAndShortcuts = ({
  layout,
  selectedButtonIds,
  selectedPrimaryId,
  onLayoutChange,
  onSelectButtons,
}: UseFreeCanvasHistoryAndShortcutsParams) => {
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [history, setHistory] = useState<CodeWindowLayout[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);
  const copiedButtonRef = useRef<CodeWindowButton | null>(null);

  const updateLayoutWithHistory = useCallback(
    (newLayout: CodeWindowLayout) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        onLayoutChange(newLayout);
        return;
      }
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newLayout);
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      onLayoutChange(newLayout);
    },
    [history, historyIndex, onLayoutChange],
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      onLayoutChange(history[prevIndex]);
    }
  }, [history, historyIndex, onLayoutChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onLayoutChange(history[nextIndex]);
    }
  }, [history, historyIndex, onLayoutChange]);

  const initialLayoutRef = useRef(layout);
  useEffect(() => {
    if (history.length === 0) {
      setHistory([initialLayoutRef.current]);
      setHistoryIndex(0);
    }
  }, [history.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true' ||
        target?.closest('[contenteditable=\"true\"]') ||
        target?.getAttribute('role') === 'textbox' ||
        target?.closest('[role=\"textbox\"]');
      if (isTextInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLinkId) {
          e.preventDefault();
          const newLayout = {
            ...layout,
            buttonLinks: layout.buttonLinks?.filter((l) => l.id !== selectedLinkId),
          };
          updateLayoutWithHistory(newLayout);
          setSelectedLinkId(null);
        } else if (selectedButtonIds.length > 0) {
          e.preventDefault();
          const newLayout = {
            ...layout,
            buttons: layout.buttons.filter((b) => !selectedButtonIds.includes(b.id)),
            buttonLinks: layout.buttonLinks?.filter(
              (l) =>
                !selectedButtonIds.includes(l.fromButtonId) &&
                !selectedButtonIds.includes(l.toButtonId),
            ),
          };
          updateLayoutWithHistory(newLayout);
          onSelectButtons([]);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        const buttonToCopy = layout.buttons.find((b) => b.id === selectedPrimaryId);
        if (buttonToCopy) {
          e.preventDefault();
          copiedButtonRef.current = { ...buttonToCopy };
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        const source = copiedButtonRef.current;
        if (source) {
          e.preventDefault();
          const newId = createButton(source.type, source.name, source.x, source.y).id;
          const offset = 12;
          const newX = Math.min(
            Math.max(0, source.x + offset),
            layout.canvasWidth - source.width,
          );
          const newY = Math.min(
            Math.max(0, source.y + offset),
            layout.canvasHeight - source.height,
          );
          const newButton: CodeWindowButton = {
            ...source,
            id: newId,
            x: newX,
            y: newY,
          };
          const updatedLayout = {
            ...layout,
            buttons: [...layout.buttons, newButton],
          };
          updateLayoutWithHistory(updatedLayout);
          onSelectButtons([newId]);
          setSelectedLinkId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleRedo,
    handleUndo,
    layout,
    onSelectButtons,
    selectedButtonIds,
    selectedLinkId,
    selectedPrimaryId,
    updateLayoutWithHistory,
  ]);

  return {
    selectedLinkId,
    setSelectedLinkId,
    updateLayoutWithHistory,
    handleUndo,
    handleRedo,
  };
};
