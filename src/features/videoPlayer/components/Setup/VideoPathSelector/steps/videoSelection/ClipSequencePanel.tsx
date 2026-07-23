import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinkIcon from '@mui/icons-material/Link';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
import type { AngleSelection } from '../../types';

interface ClipSequencePanelProps {
  angle: AngleSelection | undefined;
  angleCount: number;
  selectedClipId: string;
  onSelectClip: (clipId: string) => void;
  onUpdateAngleName: (angleId: string, name: string) => void;
  onRemoveAngle: (angleId: string) => void;
  onSelectVideo: (angleId: string, clipId: string) => void;
  onEditYoutube: (angleId: string, clipId: string, source: string) => void;
  onRemoveClip: (angleId: string, clipId: string) => void;
  onAddLocal: () => void;
  onAddYoutube: () => void;
  onAddDroppedVideos: (angleId: string, paths: string[]) => void;
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
  angleCount,
  selectedClipId,
  onSelectClip,
  onUpdateAngleName,
  onRemoveAngle,
  onSelectVideo,
  onEditYoutube,
  onRemoveClip,
  onAddLocal,
  onAddYoutube,
  onAddDroppedVideos,
  onReorderClip,
  onMoveClip,
}) => {
  const [pointerDragClipId, setPointerDragClipId] = useState<string | null>(
    null,
  );
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);

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
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setIsFileDragOver(true);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFileDragOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsFileDragOver(false);
        if (!angle) return;
        const paths = Array.from(event.dataTransfer.files)
          .map((file) =>
            window.electronAPI?.resolveDroppedVideoFilePath?.(file),
          )
          .filter((filePath): filePath is string => Boolean(filePath));
        onAddDroppedVideos(angle.id, paths);
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        outline: isFileDragOver ? '2px solid' : 'none',
        outlineColor: 'primary.main',
        outlineOffset: -2,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ px: 1.5, py: 1 }}
      >
        {angle ? (
          <TextField
            variant="standard"
            size="small"
            value={angle.name}
            onChange={(event) =>
              onUpdateAngleName(angle.id, event.target.value)
            }
            inputProps={{ 'aria-label': 'アングル名' }}
            sx={{ minWidth: 180 }}
          />
        ) : (
          <Typography variant="body2">アングル未選択</Typography>
        )}
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            aria-label="このアングルに映像を追加"
            aria-haspopup="menu"
            onClick={(event) => setAddAnchor(event.currentTarget)}
          >
            追加
          </Button>
          <Menu
            anchorEl={addAnchor}
            open={Boolean(addAnchor)}
            onClose={() => setAddAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                setAddAnchor(null);
                onAddLocal();
              }}
            >
              <ListItemIcon>
                <VideoLibraryOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="ローカル映像"
                secondary="複数のファイルを選択できます"
              />
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAddAnchor(null);
                onAddYoutube();
              }}
            >
              <ListItemIcon>
                <LinkIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="YouTube" secondary="URLを入力します" />
            </MenuItem>
          </Menu>
          <Tooltip title="アングルを削除">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={!angle || angleCount === 1}
                onClick={() => angle && onRemoveAngle(angle.id)}
                aria-label="アングルを削除"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
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
          <Typography variant="caption" color="text.secondary">
            ＋から追加するか、複数の映像をここへドロップ
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
                  同期位置は再生画面のシンクモードで設定
                </Typography>
              </Box>
              <Stack direction="row" spacing={0}>
                <IconButton
                  size="small"
                  aria-label={
                    clip.sourceKind === 'youtube'
                      ? 'YouTube URLを編集'
                      : clip.source
                        ? '映像を差し替え'
                        : '映像を選択'
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (clip.sourceKind === 'youtube')
                      onEditYoutube(angle.id, clip.id, clip.source);
                    else onSelectVideo(angle.id, clip.id);
                  }}
                >
                  <EditOutlinedIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  aria-label="映像を上へ移動"
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
                  aria-label="映像を下へ移動"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveClip(angle.id, clip.id, 1);
                  }}
                >
                  <ArrowDownwardIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={angle.clips.length === 1}
                  color="error"
                  aria-label="映像を削除"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveClip(angle.id, clip.id);
                  }}
                >
                  <DeleteOutlineIcon fontSize="inherit" />
                </IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};
