import { useCallback, useState } from 'react';
import type React from 'react';
import type { TimelineRow } from '../../../../../../types/timeline/core';

interface RowContextMenuState {
  rowId: string;
  mouseX: number;
  mouseY: number;
}

interface UseTimelineRowInteractionsParams {
  rows: TimelineRow[];
  onInstanceSelectionChange: (ids: string[]) => void;
  onUpdateRow?: (
    id: string,
    updates: Pick<TimelineRow, 'name' | 'color'>,
  ) => void;
  onMoveRow?: (sourceId: string, targetId: string) => void;
  onDeleteRows?: (ids: string[]) => void;
}

export interface TimelineRowInteractions {
  selectedRowIds: string[];
  editingRow: TimelineRow | null;
  rowNameDraft: string;
  rowColorDraft: string;
  rowContextMenu: RowContextMenuState | null;
  rowsPendingDeletion: TimelineRow[];
  onRowClick: (event: React.MouseEvent, rowId: string) => void;
  onRowContextMenu: (event: React.MouseEvent, rowId: string) => void;
  onRowDragStart: (event: React.DragEvent<HTMLElement>, rowId: string) => void;
  onRowDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onRowDrop: (event: React.DragEvent<HTMLElement>, rowId: string) => void;
  onOpenRowEditor: (row: TimelineRow) => void;
  onCloseRowEditor: () => void;
  onSaveRow: () => void;
  onRowNameDraftChange: (value: string) => void;
  onRowColorDraftChange: (value: string) => void;
  onCloseRowContextMenu: () => void;
  onEditContextRow: () => void;
  onMoveSelectedRow: (direction: -1 | 1) => void;
  onRequestDeleteRows: (ids?: string[]) => void;
  onCancelDeleteRows: () => void;
  onConfirmDeleteRows: () => void;
  clearRowSelection: () => void;
}

const ROW_DRAG_MIME = 'text/timeline-row-id';

export const useTimelineRowInteractions = ({
  rows,
  onInstanceSelectionChange,
  onUpdateRow,
  onMoveRow,
  onDeleteRows,
}: UseTimelineRowInteractionsParams): TimelineRowInteractions => {
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [editingRow, setEditingRow] = useState<TimelineRow | null>(null);
  const [rowNameDraft, setRowNameDraft] = useState('');
  const [rowColorDraft, setRowColorDraft] = useState('#4D8DFF');
  const [rowContextMenu, setRowContextMenu] =
    useState<RowContextMenuState | null>(null);
  const [rowsPendingDeletion, setRowsPendingDeletion] = useState<TimelineRow[]>(
    [],
  );

  const selectOnlyRow = useCallback(
    (rowId: string): void => {
      setSelectedRowIds([rowId]);
      onInstanceSelectionChange([]);
    },
    [onInstanceSelectionChange],
  );

  const handleRowClick = useCallback(
    (event: React.MouseEvent, rowId: string): void => {
      event.stopPropagation();
      onInstanceSelectionChange([]);
      if (event.metaKey || event.ctrlKey) {
        setSelectedRowIds((current) =>
          current.includes(rowId)
            ? current.filter((id) => id !== rowId)
            : [...current, rowId],
        );
        return;
      }
      setSelectedRowIds([rowId]);
    },
    [onInstanceSelectionChange],
  );

  const handleRowContextMenu = useCallback(
    (event: React.MouseEvent, rowId: string): void => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedRowIds.includes(rowId)) selectOnlyRow(rowId);
      setRowContextMenu({
        rowId,
        mouseX: event.clientX + 2,
        mouseY: event.clientY - 6,
      });
    },
    [selectOnlyRow, selectedRowIds],
  );

  const handleRowDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, rowId: string): void => {
      event.dataTransfer.setData(ROW_DRAG_MIME, rowId);
      event.dataTransfer.effectAllowed = 'move';
      if (!selectedRowIds.includes(rowId)) selectOnlyRow(rowId);
    },
    [selectOnlyRow, selectedRowIds],
  );

  const handleRowDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>): void => {
      if (!event.dataTransfer.types.includes(ROW_DRAG_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [],
  );

  const handleRowDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, rowId: string): void => {
      const sourceId = event.dataTransfer.getData(ROW_DRAG_MIME);
      if (!sourceId || !onMoveRow) return;
      event.preventDefault();
      event.stopPropagation();
      onMoveRow(sourceId, rowId);
    },
    [onMoveRow],
  );

  const handleOpenRowEditor = useCallback((row: TimelineRow): void => {
    setEditingRow(row);
    setRowNameDraft(row.name);
    setRowColorDraft(row.color);
    setRowContextMenu(null);
  }, []);

  const handleCloseRowEditor = useCallback((): void => {
    setEditingRow(null);
  }, []);

  const handleSaveRow = useCallback((): void => {
    if (!editingRow || !rowNameDraft.trim() || !onUpdateRow) return;
    onUpdateRow(editingRow.id, {
      name: rowNameDraft.trim(),
      color: rowColorDraft,
    });
    setEditingRow(null);
  }, [editingRow, onUpdateRow, rowColorDraft, rowNameDraft]);

  const handleEditContextRow = useCallback((): void => {
    const row = rows.find(
      (candidate) => candidate.id === rowContextMenu?.rowId,
    );
    if (row) handleOpenRowEditor(row);
  }, [handleOpenRowEditor, rowContextMenu?.rowId, rows]);

  const handleMoveSelectedRow = useCallback(
    (direction: -1 | 1): void => {
      const rowId = rowContextMenu?.rowId ?? selectedRowIds[0];
      if (!rowId || !onMoveRow) return;
      const index = rows.findIndex((row) => row.id === rowId);
      const target = rows[index + direction];
      if (!target) return;
      onMoveRow(rowId, target.id);
      setRowContextMenu(null);
    },
    [onMoveRow, rowContextMenu?.rowId, rows, selectedRowIds],
  );

  const handleRequestDeleteRows = useCallback(
    (requestedIds?: string[]): void => {
      const ids = requestedIds?.length
        ? requestedIds
        : rowContextMenu
          ? selectedRowIds.includes(rowContextMenu.rowId)
            ? selectedRowIds
            : [rowContextMenu.rowId]
          : selectedRowIds;
      const targets = rows.filter((row) => ids.includes(row.id));
      if (targets.length === 0) return;
      setRowsPendingDeletion(targets);
      setRowContextMenu(null);
    },
    [rowContextMenu, rows, selectedRowIds],
  );

  const handleConfirmDeleteRows = useCallback((): void => {
    const ids = rowsPendingDeletion.map((row) => row.id);
    onDeleteRows?.(ids);
    setSelectedRowIds((current) => current.filter((id) => !ids.includes(id)));
    setRowsPendingDeletion([]);
  }, [onDeleteRows, rowsPendingDeletion]);

  return {
    selectedRowIds,
    editingRow,
    rowNameDraft,
    rowColorDraft,
    rowContextMenu,
    rowsPendingDeletion,
    onRowClick: handleRowClick,
    onRowContextMenu: handleRowContextMenu,
    onRowDragStart: handleRowDragStart,
    onRowDragOver: handleRowDragOver,
    onRowDrop: handleRowDrop,
    onOpenRowEditor: handleOpenRowEditor,
    onCloseRowEditor: handleCloseRowEditor,
    onSaveRow: handleSaveRow,
    onRowNameDraftChange: setRowNameDraft,
    onRowColorDraftChange: setRowColorDraft,
    onCloseRowContextMenu: () => setRowContextMenu(null),
    onEditContextRow: handleEditContextRow,
    onMoveSelectedRow: handleMoveSelectedRow,
    onRequestDeleteRows: handleRequestDeleteRows,
    onCancelDeleteRows: () => setRowsPendingDeletion([]),
    onConfirmDeleteRows: handleConfirmDeleteRows,
    clearRowSelection: () => setSelectedRowIds([]),
  };
};
