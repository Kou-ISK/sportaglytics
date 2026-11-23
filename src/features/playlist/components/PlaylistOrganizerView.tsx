import React, { useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { PlaylistItem, PlaylistRow } from '../../../types/playlist/core';

import { OrganizerRowControls, RowNameEditor } from './OrganizerRowControls';
import type { OrganizerActions } from './OrganizerRowControls';

export interface PlaylistOrganizerViewProps {
  actions?: OrganizerActions;
  items: PlaylistItem[];
  rows: PlaylistRow[];
  currentIndex: number;
  selectedItemIds: Set<string>;
  onSelectItem: (
    id: string,
    modifiers: { additive: boolean; range: boolean },
  ) => void;
  onPlayItem: (id: string) => void;
}

const formatDuration = (item: PlaylistItem): string =>
  `${Math.max(0, item.endTime - item.startTime).toFixed(1)}s`;

export const PlaylistOrganizerView = ({
  items,
  rows,
  currentIndex,
  selectedItemIds,
  onSelectItem,
  onPlayItem,
  actions,
}: PlaylistOrganizerViewProps): React.ReactElement => {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const drag = useRef<string[] | null>(null);
  const displayRows = useMemo<PlaylistRow[]>(
    () =>
      rows.length > 0
        ? [...rows].sort((left, right) => left.order - right.order)
        : [
            {
              id: 'organizer-default-row',
              name: 'クリップ',
              enabled: true,
              order: 0,
            },
          ],
    [rows],
  );
  const itemsByRow = useMemo(() => {
    const result = new Map<string, PlaylistItem[]>();
    displayRows.forEach((row) => result.set(row.id, []));
    items.forEach((item) => {
      const rowId =
        item.rowId && result.has(item.rowId) ? item.rowId : displayRows[0]?.id;
      if (!rowId) return;
      result.get(rowId)?.push(item);
    });
    result.forEach((rowItems) =>
      rowItems.sort(
        (left, right) => (left.rowOrder ?? 0) - (right.rowOrder ?? 0),
      ),
    );
    return result;
  }, [displayRows, items]);

  return (
    <Paper
      component="section"
      elevation={0}
      data-testid="playlist-organizer"
      aria-label="Organizer workspace"
      sx={{ height: '100%', overflow: 'auto', bgcolor: 'background.paper' }}
    >
      <Box sx={{ minWidth: 760 }}>
        <Box
          sx={{
            display: 'flex',
            position: 'sticky',
            top: 0,
            zIndex: 5,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            height: 28,
          }}
        >
          <Typography
            sx={{
              width: 220,
              flex: '0 0 220px',
              px: 1,
              py: 0.5,
              fontSize: 12,
              color: 'text.secondary',
            }}
          >
            行 / クリップ
          </Typography>
          <Typography
            sx={{ px: 1, py: 0.5, fontSize: 12, color: 'text.secondary' }}
          >
            プレゼンテーション順
          </Typography>
          {actions && <Button size="small" onClick={() => setAdding(true)}>行を追加</Button>}
          {adding && actions && <RowNameEditor initial="" title="行を追加" onCommit={actions.add} onClose={() => setAdding(false)} />}
        </Box>
        {displayRows.map((row, index) => {
          const rowItems = itemsByRow.get(row.id) ?? [];
          return (
            <Box
              key={row.id}
              onDragOver={(event) => { if (actions && drag.current) event.preventDefault(); }}
              onDrop={(event) => {
                if (!actions || !drag.current) return;
                event.preventDefault();
                actions.moveClips(drag.current, row.id);
                drag.current = null;
              }}
              data-testid={`organizer-row-${row.id}`}
              sx={{
                display: 'flex',
                minHeight: 66,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: row.enabled ? 'background.paper' : 'action.hover',
              }}
            >
              <Box
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  width: 220,
                  flex: '0 0 220px',
                  px: 1,
                  py: 0.75,
                  bgcolor: 'background.paper',
                  borderRight: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box
                    sx={{
                      width: 4,
                      height: 34,
                      borderRadius: 1,
                      bgcolor: row.color ?? theme.palette.primary.main,
                    }}
                  />
                  <Checkbox
                    size="small"
                    checked={row.enabled}
                    inputProps={{ 'aria-label': `${row.name} enabled` }}
                    readOnly
                    sx={{ p: 0 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 600, opacity: row.enabled ? 1 : 0.55 }}
                    >
                      {row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rowItems.length} クリップ
                    </Typography>
                  </Box>
                  {actions && <OrganizerRowControls row={row} index={index} rowCount={displayRows.length}
                    itemIds={rowItems.map((item) => item.id)} selection={selectedItemIds} actions={actions} />}
                </Stack>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  p: 0.75,
                  minWidth: 540,
                  flex: 1,
                  alignItems: 'stretch',
                }}
              >
                {rowItems.map((item) => {
                  const itemIndex = items.findIndex(
                    (entry) => entry.id === item.id,
                  );
                  const selected = selectedItemIds.has(item.id);
                  const playing = currentIndex === itemIndex;
                  return (
                    <Box
                      key={item.id}
                      draggable={Boolean(actions)}
                      onDragStart={(event) => {
                        drag.current = selected ? [...selectedItemIds] : [item.id];
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('application/x-sportag-playlist-items', 'move');
                      }}
                      onDragEnd={() => { drag.current = null; }}
                      data-testid={`organizer-clip-${item.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={(event) =>
                        onSelectItem(item.id, {
                          additive: event.metaKey || event.ctrlKey,
                          range: event.shiftKey,
                        })
                      }
                      onDoubleClick={() => onPlayItem(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectItem(item.id, {
                            additive: false,
                            range: false,
                          });
                        }
                      }}
                      sx={{
                        flex: '0 0 150px',
                        minHeight: 50,
                        px: 1,
                        py: 0.5,
                        cursor: 'pointer',
                        borderRadius: 1,
                        border: 1,
                        borderColor:
                          selected || playing ? 'primary.main' : 'divider',
                        bgcolor: selected
                          ? 'action.selected'
                          : 'background.default',
                        borderLeftWidth: playing ? 3 : 1,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {itemIndex + 1} · {formatDuration(item)}
                      </Typography>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: selected || playing ? 600 : 400 }}
                      >
                        {item.actionName || '名称なし'}
                      </Typography>
                      {item.annotation ? (
                        <Typography variant="caption" color="info.main">
                          ● 注釈
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })}
                {rowItems.length === 0 ? (
                  <Box
                    data-testid={`organizer-empty-row-${row.id}`}
                    sx={{
                      flex: 1,
                      minHeight: 50,
                      border: '1px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      px: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      この行にはクリップがありません
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          );
        })}
        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            プレイリストが空です。タイムラインからクリップを追加してください。
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
};
