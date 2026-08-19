import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeWindowLayout } from '../../../../../types/settings/coreTypes';
import {
  copyCodeWindowSelection,
  pasteCodeWindowSelection,
  type CopiedCodeWindowSelection,
} from '../freeCanvasClipboard';

interface UseFreeCanvasHistoryAndShortcutsParams {
  layout: CodeWindowLayout;
  selectedButtonIds: string[];
  onLayoutChange: (layout: CodeWindowLayout) => void;
  onSelectButtons: (ids: string[]) => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
};

export const useFreeCanvasHistoryAndShortcuts = ({
  layout,
  selectedButtonIds,
  onLayoutChange,
  onSelectButtons,
}: UseFreeCanvasHistoryAndShortcutsParams) => {
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [history, setHistory] = useState<CodeWindowLayout[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const copiedSelectionRef = useRef<CopiedCodeWindowSelection | null>(null);
  const pasteCountRef = useRef(0);

  const updateLayoutWithHistory = useCallback(
    (newLayout: CodeWindowLayout): void => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newLayout);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      onLayoutChange(newLayout);
    },
    [history, historyIndex, onLayoutChange],
  );

  const handleUndo = useCallback((): void => {
    if (historyIndex <= 0) return;
    const prevIndex = historyIndex - 1;
    setHistoryIndex(prevIndex);
    onLayoutChange(history[prevIndex]);
  }, [history, historyIndex, onLayoutChange]);

  const handleRedo = useCallback((): void => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    onLayoutChange(history[nextIndex]);
  }, [history, historyIndex, onLayoutChange]);

  const initialLayoutRef = useRef(layout);
  useEffect(() => {
    if (history.length !== 0) return;
    setHistory([initialLayoutRef.current]);
    setHistoryIndex(0);
  }, [history.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      const primary = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (primary && key === 'a') {
        event.preventDefault();
        onSelectButtons(layout.buttons.map((button) => button.id));
        setSelectedLinkId(null);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedLinkId) {
          event.preventDefault();
          updateLayoutWithHistory({
            ...layout,
            buttonLinks: layout.buttonLinks?.filter(
              (link) => link.id !== selectedLinkId,
            ),
          });
          setSelectedLinkId(null);
          return;
        }
        if (selectedButtonIds.length > 0) {
          event.preventDefault();
          updateLayoutWithHistory({
            ...layout,
            buttons: layout.buttons.filter(
              (button) => !selectedButtonIds.includes(button.id),
            ),
            buttonLinks: layout.buttonLinks?.filter(
              (link) =>
                !selectedButtonIds.includes(link.fromButtonId) &&
                !selectedButtonIds.includes(link.toButtonId),
            ),
          });
          onSelectButtons([]);
          return;
        }
      }

      if (primary && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (primary && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (primary && key === 'c') {
        const copied = copyCodeWindowSelection(layout, selectedButtonIds);
        if (!copied) return;
        event.preventDefault();
        copiedSelectionRef.current = copied;
        pasteCountRef.current = 0;
        return;
      }

      if (primary && key === 'v') {
        const copied = copiedSelectionRef.current;
        if (!copied) return;
        event.preventDefault();
        pasteCountRef.current += 1;
        const offset = 12 * pasteCountRef.current;
        const pasted = pasteCodeWindowSelection(layout, copied, {
          offsetX: offset,
          offsetY: offset,
        });
        updateLayoutWithHistory(pasted.layout);
        onSelectButtons(pasted.selectedButtonIds);
        setSelectedLinkId(null);
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
