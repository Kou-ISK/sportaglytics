import React from 'react';
import {
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import type { AngleSelection } from '../../types';

interface ClipInspectorProps {
  angles: AngleSelection[];
  angle: AngleSelection | undefined;
  selectedClipId: string;
  onSelectVideo: (angleId: string, clipId: string) => void;
  onRemoveAngle: (angleId: string) => void;
  onUpdateAngleName: (angleId: string, name: string) => void;
  onRemoveClip: (angleId: string, clipId: string) => void;
  onUpdateClip: (
    angleId: string,
    clipId: string,
    updates: Partial<{
      sourceKind: 'local' | 'youtube';
      source: string;
      gapBeforeSeconds: number;
    }>,
  ) => void;
}

const toSourceKind = (value: string): 'local' | 'youtube' =>
  value === 'youtube' ? 'youtube' : 'local';

export const ClipInspector: React.FC<ClipInspectorProps> = ({
  angles,
  angle,
  selectedClipId,
  onSelectVideo,
  onRemoveAngle,
  onUpdateAngleName,
  onRemoveClip,
  onUpdateClip,
}) => {
  const clip = angle?.clips.find(
    (candidate) => candidate.id === selectedClipId,
  );

  return (
    <Box
      sx={{
        p: 1.5,
        minWidth: 0,
        minHeight: 0,
        overflowY: 'auto',
        gridColumn: { md: '1 / -1', lg: '3' },
        borderTop: { md: '1px solid', lg: 'none' },
        borderColor: 'divider',
      }}
    >
      <Typography variant="overline" color="text.secondary">
        Inspector
      </Typography>
      {angle ? (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="アングル名"
            value={angle.name}
            onChange={(event) =>
              onUpdateAngleName(angle.id, event.target.value)
            }
            fullWidth
          />
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={angles.length === 1}
            onClick={() => onRemoveAngle(angle.id)}
            sx={{ alignSelf: 'flex-start' }}
          >
            アングルを削除
          </Button>
          <Divider />

          {clip ? (
            <>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={clip.sourceKind}
                onChange={(_event, value: string | null) => {
                  if (!value) return;
                  onUpdateClip(angle.id, clip.id, {
                    sourceKind: toSourceKind(value),
                    source: '',
                  });
                }}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 1,
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <ToggleButton value="local">Local</ToggleButton>
                <ToggleButton value="youtube">YouTube</ToggleButton>
              </ToggleButtonGroup>

              {clip.sourceKind === 'local' ? (
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => onSelectVideo(angle.id, clip.id)}
                  fullWidth
                >
                  {clip.source ? '映像を差し替え' : '映像を選択'}
                </Button>
              ) : (
                <TextField
                  size="small"
                  label="YouTube URL"
                  value={clip.source}
                  onChange={(event) =>
                    onUpdateClip(angle.id, clip.id, {
                      source: event.target.value,
                    })
                  }
                  fullWidth
                />
              )}

              <TextField
                size="small"
                type="number"
                label="前の空白"
                value={clip.gapBeforeSeconds}
                inputProps={{ min: 0, step: 0.1 }}
                onChange={(event) =>
                  onUpdateClip(angle.id, clip.id, {
                    gapBeforeSeconds: Math.max(0, Number(event.target.value)),
                  })
                }
                helperText="秒。同期位置を後ろへずらします"
                fullWidth
              />
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                disabled={angle.clips.length === 1}
                onClick={() => onRemoveClip(angle.id, clip.id)}
                sx={{ alignSelf: 'flex-start' }}
              >
                クリップを削除
              </Button>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              クリップを選択すると詳細を編集できます。
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          アングルを選択してください。
        </Typography>
      )}
    </Box>
  );
};
