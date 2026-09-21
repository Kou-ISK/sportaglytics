import { PlaylistNoteEditor } from './PlaylistNoteEditor';
import type { ReactElement } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import type { PlaylistItem } from '../../../types/playlist/core';
import type {
  SorterColumn,
  SorterColumnId,
  SorterSort,
  SorterSortKey,
  SorterDirection,
} from '../domain/playlistSorter';
import {
  formatSorterTime,
  sorterLabels,
  sorterVideoName,
} from '../domain/playlistSorter';
import { PlaylistSorterToolbarView } from './PlaylistSorterToolbarView';

export interface PlaylistSorterViewProps {
  items: PlaylistItem[];
  editingNoteId: string | null;
  onEditNote: (id: string | null) => void;
  onCommitNote: (note: string, direction?: -1 | 1) => void;
  totalCount: number;
  positions: ReadonlyMap<string, number>;
  currentItemId: string | null;
  selectedItemIds: Set<string>;
  columns: SorterColumn[];
  query: string;
  sort: SorterSort | null;
  onQueryChange: (query: string) => void;
  onSort: (column: SorterSortKey, direction: SorterDirection) => void;
  onToggleColumn: (column: SorterColumnId) => void;
  onSelectItem: (
    id: string,
    modifiers: { additive: boolean; range: boolean },
  ) => void;
  onPlayItem: (id: string) => void;
  onDeleteSelected: () => void;
}

export const PlaylistSorterView = (
  props: PlaylistSorterViewProps,
): ReactElement => {
  const {
    items,
    totalCount,
    positions,
    currentItemId,
    selectedItemIds,
    sort,
    onSort,
    onSelectItem,
    onPlayItem,
    onDeleteSelected,
  } = props;
  const visibleColumns = props.columns.filter((column) => column.visible);
  return (
    <Paper
      component="section"
      elevation={0}
      data-testid="playlist-sorter"
      aria-label="Sorter workspace"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          (event.key === 'Delete' || event.key === 'Backspace') &&
          event.target === event.currentTarget
        ) {
          event.preventDefault();
          onDeleteSelected();
        }
      }}
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <PlaylistSorterToolbarView {...props} />
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table
          size="small"
          stickyHeader
          aria-label="プレイリストのクリップ"
          sx={{
            minWidth: 960,
            tableLayout: 'fixed',
            '& th, & td': {
              borderColor: 'divider',
              py: 0.25,
              px: 0.75,
              height: 28,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: 12,
            },
          }}
        >
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => {
                const sorted = sort?.column === column.id;
                const sortableId = column.id === 'index' ? null : column.id;
                const nextDirection =
                  sorted && sort?.direction === 'asc' ? 'desc' : 'asc';
                return (
                  <TableCell
                    key={column.id}
                    scope="col"
                    sortDirection={sorted ? sort.direction : false}
                    sx={{
                      width: column.width,
                      fontWeight: 600,
                      zIndex: (theme) => theme.custom.zIndex.stickyChrome,
                    }}
                  >
                    {sortableId ? (
                      <TableSortLabel
                        active={sorted}
                        direction={sorted ? sort.direction : 'asc'}
                        aria-label={`${column.label}を${nextDirection === 'asc' ? '昇順' : '降順'}に並べ替え`}
                        onClick={() => onSort(sortableId, nextDirection)}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                hover
                selected={selectedItemIds.has(item.id)}
                data-testid={`sorter-row-${item.id}`}
                aria-selected={selectedItemIds.has(item.id)}
                aria-current={item.id === currentItemId ? true : undefined}
                tabIndex={0}
                onClick={(event) =>
                  onSelectItem(item.id, {
                    additive: event.metaKey || event.ctrlKey,
                    range: event.shiftKey,
                  })
                }
                onDoubleClick={() => onPlayItem(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    onPlayItem(item.id);
                  }
                  if (event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectItem(item.id, {
                      additive: event.metaKey || event.ctrlKey,
                      range: event.shiftKey,
                    });
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  '&.Mui-selected': { bgcolor: 'action.selected' },
                  ...(item.id === currentItemId
                    ? { borderLeft: 2, borderColor: 'primary.main' }
                    : {}),
                }}
              >
                {visibleColumns.map((column) => {
                  let value: string | number;
                  switch (column.id) {
                    case 'index':
                      value = positions.get(item.id) ?? '';
                      break;
                    case 'action':
                      value = item.actionName;
                      break;
                    case 'start':
                      value = formatSorterTime(item.startTime);
                      break;
                    case 'duration':
                      value = `${(item.endTime - item.startTime).toFixed(1)}s`;
                      break;
                    case 'labels':
                      value = sorterLabels(item);
                      break;
                    case 'note':
                      value = item.note ?? '';
                      break;
                    case 'annotation':
                      value = item.annotation ? '●' : '';
                      break;
                    case 'video':
                      value = sorterVideoName(item);
                      break;
                  }
                  return (
                    <TableCell
                      key={column.id}
                      tabIndex={column.id === 'note' ? 0 : undefined}
                      onDoubleClick={
                        column.id === 'note'
                          ? (event) => {
                              event.stopPropagation();
                              props.onEditNote(item.id);
                            }
                          : undefined
                      }
                      onKeyDown={
                        column.id === 'note'
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === 'F2') {
                                event.preventDefault();
                                event.stopPropagation();
                                props.onEditNote(item.id);
                              }
                            }
                          : undefined
                      }
                      title={String(value)}
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        position: column.id === 'index' ? 'sticky' : undefined,
                        left: column.id === 'index' ? 0 : undefined,
                        bgcolor:
                          column.id === 'index'
                            ? 'background.paper'
                            : undefined,
                        zIndex:
                          column.id === 'index'
                            ? (theme) => theme.custom.zIndex.timelineItem
                            : undefined,
                      }}
                    >
                      {column.id === 'note' &&
                      props.editingNoteId === item.id ? (
                        <PlaylistNoteEditor
                          key={`${item.id}:${item.note ?? ''}`}
                          note={item.note ?? ''}
                          autoFocus
                          compact
                          onCommit={props.onCommitNote}
                          onCancel={() => props.onEditNote(null)}
                        />
                      ) : (
                        value ||
                        (column.id === 'note'
                          ? 'ダブルクリックでノートを入力'
                          : '')
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalCount === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            プレイリストが空です。タイムラインからクリップを追加してください。
          </Typography>
        ) : items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            検索結果がありません。検索条件を解除してください。
          </Typography>
        ) : null}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 1, py: 0.5 }}
      >
        {items.length} / {totalCount} クリップ
      </Typography>
    </Paper>
  );
};
