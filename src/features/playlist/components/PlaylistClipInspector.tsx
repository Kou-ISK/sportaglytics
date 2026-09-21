import { PlaylistNoteEditor } from './PlaylistNoteEditor';
import React from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { useTheme } from '@mui/material/styles';
import type {
  ItemAnnotation,
  PlaylistItem,
} from '../../../types/playlist/core';

type PlaylistClipInspectorProps = {
  item: PlaylistItem | null;
  annotation?: ItemAnnotation | null;
  width: number;
  onEditNote: (itemId: string) => void;
  onPlay: (itemId: string) => void;
  onUpdateNote: (itemId: string, note: string) => void;
};

const formatTime = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
};

export const PlaylistClipInspector = ({
  item,
  annotation,
  width,
  onEditNote,
  onPlay,
  onUpdateNote,
}: PlaylistClipInspectorProps): React.ReactElement => {
  const theme = useTheme();
  const annotationCount = annotation?.objects.length ?? 0;

  return (
    <Paper
      component="aside"
      square
      elevation={0}
      data-testid="playlist-clip-inspector"
      sx={{
        width,
        minWidth: 220,
        maxWidth: '45%',
        overflow: 'auto',
        bgcolor: theme.palette.background.paper,
        borderLeft: '1px solid',
        borderColor: theme.palette.divider,
        px: 1.5,
        py: 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="overline" sx={{ flex: 1, letterSpacing: 1 }}>
          クリップ詳細
        </Typography>
        {item ? (
          <>
            <Tooltip title="クリップを再生">
              <IconButton
                size="small"
                aria-label="クリップを再生"
                onClick={() => onPlay(item.id)}
              >
                <PlayArrow fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="ノートを編集">
              <IconButton
                size="small"
                aria-label="ノートを編集"
                onClick={() => onEditNote(item.id)}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Stack>

      {!item ? (
        <Typography variant="body2" color="text.secondary">
          クリップを選択すると詳細を表示します。
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          <Box>
            <Typography variant="subtitle2" noWrap>
              {item.actionName || '名称なし'}
            </Typography>
            <Typography
              variant="technical"
              color="primary.main"
              sx={{
                display: 'block',
                mt: 0.75,
                p: 1,
                bgcolor: 'background.default',
                borderRadius: 0.5,
              }}
            >
              {formatTime(item.startTime)} – {formatTime(item.endTime)}
              {' · '}
              {(item.endTime - item.startTime).toFixed(1)}s
            </Typography>
          </Box>

          <Divider />
          <InspectorField label="ラベル">
            {item.labels?.length ? (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {item.labels.map((label) => (
                  <Chip
                    key={`${label.group ?? ''}-${label.name}`}
                    label={label.name}
                    size="small"
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                なし
              </Typography>
            )}
          </InspectorField>
          <PlaylistNoteEditor
            key={`${item.id}:${item.note ?? ''}`}
            note={item.note ?? ''}
            onCommit={(note) => {
              if (note !== (item.note ?? '')) onUpdateNote(item.id, note);
            }}
          />
          <InspectorField label="プレゼンテーション">
            <Typography variant="body2">
              Freeze {annotation?.freezeDuration?.toFixed(1) ?? '0.0'}s
              {annotationCount ? ` · Drawing ${annotationCount}` : ''}
            </Typography>
          </InspectorField>
          <InspectorField label="映像">
            <Typography variant="body2" noWrap title={item.videoSource}>
              Angle 1: {item.videoSource || '未指定'}
              {item.videoSource2 ? ` · Angle 2: ${item.videoSource2}` : ''}
            </Typography>
          </InspectorField>
        </Stack>
      )}
    </Paper>
  );
};

const InspectorField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <Box>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block' }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);
