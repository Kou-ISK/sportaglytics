import { useCallback } from 'react';
import type React from 'react';
import type { AnalysisDashboardWidget } from '../../../../../../../types/Settings';

interface UseDashboardWidgetDraftActionsParams {
  setDraftWidgets: React.Dispatch<React.SetStateAction<AnalysisDashboardWidget[]>>;
  setEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useDashboardWidgetDraftActions = ({
  setDraftWidgets,
  setEditorOpen,
}: UseDashboardWidgetDraftActionsParams) => {
  const handleEditorSave = useCallback(
    (widget: AnalysisDashboardWidget) => {
      setDraftWidgets((prev) => {
        const exists = prev.find((w) => w.id === widget.id);
        if (exists) {
          return prev.map((w) => (w.id === widget.id ? widget : w));
        }
        return [...prev, widget];
      });
      setEditorOpen(false);
    },
    [setDraftWidgets, setEditorOpen],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setDraftWidgets((prev) => prev.filter((widget) => widget.id !== id));
    },
    [setDraftWidgets],
  );

  const handleDuplicate = useCallback(
    (widget: AnalysisDashboardWidget) => {
      setDraftWidgets((prev) => [
        ...prev,
        {
          ...widget,
          id: `${widget.id}-copy-${Date.now()}`,
          title: `${widget.title} (コピー)`,
        },
      ]);
    },
    [setDraftWidgets],
  );

  const handleMove = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setDraftWidgets((prev) => {
        const index = prev.findIndex((widget) => widget.id === id);
        if (index < 0) return prev;
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= prev.length) return prev;
        const next = [...prev];
        const temp = next[index];
        next[index] = next[nextIndex];
        next[nextIndex] = temp;
        return next;
      });
    },
    [setDraftWidgets],
  );

  return {
    handleEditorSave,
    handleDelete,
    handleDuplicate,
    handleMove,
  };
};
