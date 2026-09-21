import { useCallback, useMemo, useState } from 'react';
import type { PlaylistItem } from '../../../../types/playlist/core';
import type { PlaylistSorterViewProps } from '../../components/PlaylistSorterView';
import {
  DEFAULT_SORTER_COLUMNS,
  filterSorterItems,
  sortSorterItems,
} from '../../domain/playlistSorter';
import type {
  SorterColumnId,
  SorterDirection,
  SorterSort,
  SorterSortKey,
} from '../../domain/playlistSorter';

interface Params {
  items: PlaylistItem[];
  currentIndex: number;
  selectedItemIds: Set<string>;
  onSelectItem: (
    id: string,
    modifiers: { additive: boolean; range: boolean },
    visibleIds?: string[],
  ) => void;
  onPlayItem: (id: string) => void;
  onDeleteSelected: () => void;
  onReorder: (ids: string[]) => void;
  onUpdateNote: (itemId: string, note: string) => void;
}
export const usePlaylistSorter = ({
  items,
  currentIndex,
  selectedItemIds,
  onSelectItem,
  onPlayItem,
  onDeleteSelected,
  onReorder,
  onUpdateNote,
}: Params): PlaylistSorterViewProps => {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [columns, setColumns] = useState(DEFAULT_SORTER_COLUMNS);
  const [sort, setSort] = useState<SorterSort | null>(null);
  const displayItems = useMemo(
    () => filterSorterItems(items, query),
    [items, query],
  );
  const positions = useMemo(
    () => new Map(items.map((item, index) => [item.id, index + 1])),
    [items],
  );
  const onSort = useCallback(
    (column: SorterSortKey, direction: SorterDirection): void => {
      const sorted = sortSorterItems(items, column, direction);
      setSort({ column, direction });
      if (sorted.some((item, index) => item.id !== items[index].id))
        onReorder(sorted.map((item) => item.id));
    },
    [items, onReorder],
  );
  const appliedSort = useMemo(
    () =>
      sort &&
      sortSorterItems(items, sort.column, sort.direction).every(
        (item, index) => item.id === items[index].id,
      )
        ? sort
        : null,
    [items, sort],
  );
  const onToggleColumn = useCallback((id: SorterColumnId): void => {
    if (id === 'index') return;
    setColumns((previous) =>
      previous.map((column) =>
        column.id === id ? { ...column, visible: !column.visible } : column,
      ),
    );
  }, []);
  return {
    editingNoteId,
    onEditNote: setEditingNoteId,
    onCommitNote: (note, direction) => {
      const item = displayItems.find((entry) => entry.id === editingNoteId);
      if (!item) {
        setEditingNoteId(null);
        return;
      }
      const next = direction
        ? displayItems[displayItems.indexOf(item) + direction]
        : undefined;
      if (note !== (item.note ?? '')) onUpdateNote(item.id, note);
      setEditingNoteId(next?.id ?? null);
    },
    items: displayItems,
    totalCount: items.length,
    positions,
    currentItemId: items[currentIndex]?.id ?? null,
    selectedItemIds,
    columns,
    query,
    sort: appliedSort,
    onQueryChange: setQuery,
    onSort,
    onToggleColumn,
    onSelectItem: (id, modifiers) =>
      onSelectItem(
        id,
        modifiers,
        displayItems.map((item) => item.id),
      ),
    onPlayItem,
    onDeleteSelected,
  };
};
