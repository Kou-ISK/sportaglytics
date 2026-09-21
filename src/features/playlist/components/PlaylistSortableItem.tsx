import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Delete,
  DragIndicator,
  Edit,
  PauseCircle,
  Brush,
} from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlaylistItem } from '../../../types/playlist/core';

type PlaylistSortableItemProps = {
  item: PlaylistItem;
  index: number;
  isActive: boolean;
  selected: boolean;
  onRemove: (id: string) => void;
  onPlay: (id: string) => void;
  onEditNote: (id: string) => void;
  onToggleSelect: (id: string) => void;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const PlaylistSortableItem = ({
  item,
  index,
  isActive,
  selected,
  onRemove,
  onPlay,
  onEditNote,
  onToggleSelect,
}: PlaylistSortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const duration = item.endTime - item.startTime;
  const hasAnnotation =
    item.annotation &&
    (item.annotation.objects.length > 0 || item.annotation.freezeDuration > 0);

  const theme = useTheme();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <ListItemButton
      ref={setNodeRef}
      style={style}
      selected={isActive}
      onClick={() => onPlay(item.id)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      sx={{
        py: 0.5,
        px: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        borderLeft: isActive
          ? `3px solid ${theme.palette.primary.main}`
          : '3px solid transparent',
        bgcolor: isActive
          ? alpha(theme.palette.primary.main, 0.15)
          : 'transparent',
        '&:hover': {
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, 0.2)
            : theme.palette.action.hover,
        },
        '&.Mui-selected': {
          bgcolor: alpha(theme.palette.primary.main, 0.15),
        },
      }}
    >
      <Checkbox
        size="small"
        checked={selected}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect(item.id);
        }}
        sx={{ py: 0, px: 0.5 }}
      />

      <Typography
        variant="caption"
        sx={{
          width: 24,
          textAlign: 'center',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? 'primary.main' : 'text.secondary',
        }}
      >
        {index + 1}
      </Typography>

      <Box
        {...attributes}
        {...listeners}
        sx={{
          mx: 0.5,
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: 'text.disabled',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        <DragIndicator fontSize="small" />
      </Box>

      <ListItemText
        primary={
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'primary.main' : 'text.primary',
                maxWidth: 150,
              }}
            >
              {item.actionName}
            </Typography>
            {item.note && (
              <Typography
                component="span"
                role="button"
                tabIndex={0}
                variant="caption"
                onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
                  event.stopPropagation();
                  onEditNote(item.id);
                }}
                onKeyDown={(event: React.KeyboardEvent<HTMLSpanElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onEditNote(item.id);
                  }
                }}
                sx={{
                  maxWidth: 150,
                  ml: 0.5,
                  px: 0.5,
                  overflow: 'hidden',
                  color: 'text.secondary',
                  cursor: 'pointer',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  font: 'inherit',
                  textAlign: 'left',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {item.note}
              </Typography>
            )}
            {hasAnnotation && (
              <Tooltip
                title={`描画あり${item.annotation?.freezeDuration ? ` (${item.annotation.freezeDuration}秒停止)` : ''}`}
              >
                <Brush
                  fontSize="small"
                  sx={{ fontSize: 14, color: 'info.main' }}
                />
              </Tooltip>
            )}
          </Stack>
        }
        secondary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
            >
              {formatTime(item.startTime)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ({formatTime(duration)})
            </Typography>
            {item.annotation?.freezeDuration ? (
              <PauseCircle
                sx={{ fontSize: 12, color: 'warning.main', ml: 0.5 }}
              />
            ) : null}
          </Stack>
        }
        sx={{ my: 0 }}
      />

      <ListItemSecondaryAction
        sx={{
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        <Stack direction="row" spacing={0}>
          <Tooltip title="ノートを編集">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onEditNote(item.id);
              }}
            >
              <Edit fontSize="small" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(item.id);
              }}
            >
              <Delete fontSize="small" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </ListItemSecondaryAction>
    </ListItemButton>
  );
};
