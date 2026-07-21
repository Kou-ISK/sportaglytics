import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LinkIcon from '@mui/icons-material/Link';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import type { AngleSelection } from '../../types';

interface ClipSequencePanelProps {
  angle: AngleSelection | undefined;
  selectedClipId: string;
  onSelectClip: (clipId: string) => void;
  onSelectVideos: (angleId: string) => void;
  onAddClip: () => void;
  onReorderClip: (
    angleId: string,
    activeClipId: string,
    overClipId: string,
  ) => void;
  onMoveClip: (angleId: string, clipId: string, direction: -1 | 1) => void;
}

const fileName = (source: string): string =>
  source.split(/[\\/]/).pop() || '映像を選択';

export const ClipSequencePanel: React.FC<ClipSequencePanelProps> = ({
  angle,
  selectedClipId,
  onSelectClip,
  onSelectVideos,
  onAddClip,
  onReorderClip,
  onMoveClip,
}) => {
  const [pointerDragClipId, setPointerDragClipId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const stopPointerDrag = (): void => setPointerDragClipId(null);
    window.addEventListener('pointerup', stopPointerDrag);
    window.addEventListener('pointercancel', stopPointerDrag);
    return () => {
      window.removeEventListener('pointerup', stopPointerDrag);
      window.removeEventListener('pointercancel', stopPointerDrag);
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRight: { md: '1px solid' },
        borderColor: 'divider',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ px: 1.5, py: 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {angle?.name ?? 'アングル未選択'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Import in Sequence
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={() => angle && onSelectVideos(angle.id)}
            disabled={!angle}
            aria-label="複数選択"
            sx={{ whiteSpace: 'nowrap' }}
          >
            複数選択
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddClip}
            disabled={!angle || angle.clips.length >= 16}
            aria-label="空クリップ"
            sx={{ whiteSpace: 'nowrap' }}
          >
            空クリップ
          </Button>
        </Stack>
      </Stack>
      <Divider />

      {!angle || angle.clips.length === 0 ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ minHeight: 280 }}
        >
          <MovieOutlinedIcon color="disabled" />
          <Typography variant="body2" color="text.secondary">
            このアングルには映像がありません
          </Typography>
        </Stack>
      ) : (
        <Stack
          spacing={0.75}
          sx={{ p: 1, overflowY: 'auto', flex: 1, minHeight: 0 }}
        >
          {angle.clips.map((clip, index) => (
            <Paper
              key={clip.id}
              variant="outlined"
              data-clip-row={clip.id}
              onPointerEnter={() => {
                if (pointerDragClipId && pointerDragClipId !== clip.id) {
                  onReorderClip(angle.id, pointerDragClipId, clip.id);
                }
              }}
              onClick={() => onSelectClip(clip.id)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '28px 28px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 0.5,
                px: 0.75,
                py: 0.75,
                cursor: 'pointer',
                borderColor:
                  clip.id === selectedClipId ? 'primary.main' : 'divider',
                bgcolor:
                  clip.id === selectedClipId
                    ? 'action.selected'
                    : 'background.paper',
              }}
            >
              <Box
                component="span"
                data-clip-drag-handle={clip.id}
                aria-hidden="true"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setPointerDragClipId(clip.id);
                }}
                sx={{
                  display: 'flex',
                  cursor: pointerDragClipId === clip.id ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
              >
                <DragIndicatorIcon fontSize="small" color="disabled" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {String(index + 1).padStart(2, '0')}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {clip.sourceKind === 'youtube' ? (
                    <LinkIcon fontSize="small" color="error" />
                  ) : (
                    <MovieOutlinedIcon fontSize="small" color="action" />
                  )}
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {clip.sourceKind === 'youtube'
                      ? clip.source || 'YouTube URLを入力'
                      : fileName(clip.source)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {clip.gapBeforeSeconds > 0
                    ? `前に ${clip.gapBeforeSeconds.toFixed(1)} 秒の空白`
                    : '前のクリップに続けて配置'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0}>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  aria-label="クリップを上へ移動"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveClip(angle.id, clip.id, -1);
                  }}
                >
                  <ArrowUpwardIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={index === angle.clips.length - 1}
                  aria-label="クリップを下へ移動"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveClip(angle.id, clip.id, 1);
                  }}
                >
                  <ArrowDownwardIcon fontSize="inherit" />
                </IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};
