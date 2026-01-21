import React from 'react';
import { Box, List, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { PlaylistItem } from '../../../types/Playlist';
import { PlaylistSortableItem } from './PlaylistSortableItem';

type PlaylistItemSectionProps = {
  items: PlaylistItem[];
  currentIndex: number;
  selectedItemIds: Set<string>;
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  onRemove: (id: string) => void;
  onPlay: (id: string) => void;
  onEditNote: (id: string) => void;
  onToggleSelect: (id: string) => void;
};

export const PlaylistItemSection = ({
  items,
  currentIndex,
  selectedItemIds,
  sensors,
  onDragEnd,
  onRemove,
  onPlay,
  onEditNote,
  onToggleSelect,
}: PlaylistItemSectionProps) => {
  const theme = useTheme();

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          bgcolor: theme.palette.background.paper,
          px: 1,
          py: 0.5,
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: theme.palette.divider,
        }}
      >
        <Stack direction="row" alignItems="center">
          <Typography
            variant="caption"
            sx={{ width: 24, textAlign: 'center', color: 'text.secondary' }}
          >
            #
          </Typography>
          <Typography
            variant="caption"
            sx={{ flex: 1, ml: 3, color: 'text.secondary' }}
          >
            アクション
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            時間
          </Typography>
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        {items.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
            }}
          >
            <Typography color="text.secondary" textAlign="center">
              プレイリストが空です。
              <br />
              タイムライン上でアクションを右クリックして
              <br />
              「プレイリストに追加」を選択してください。
            </Typography>
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <List disablePadding>
                {items.map((item, index) => (
                  <PlaylistSortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    isActive={index === currentIndex}
                    selected={selectedItemIds.has(item.id)}
                    onRemove={onRemove}
                    onPlay={onPlay}
                    onEditNote={onEditNote}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        )}
      </Box>
    </>
  );
};
