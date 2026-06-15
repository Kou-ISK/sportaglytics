import React from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { AngleSelection } from '../types';

interface VideoSelectionStepProps {
  angles: AngleSelection[];
  onSelectVideo: (angleId: string) => void;
  onAddAngle: () => void;
  onRemoveAngle: (angleId: string) => void;
  onUpdateAngleName: (angleId: string, name: string) => void;
}

/**
 * Step 3: アングルの追加/割り当て
 */
export const VideoSelectionStep: React.FC<VideoSelectionStepProps> = ({
  angles,
  onSelectVideo,
  onAddAngle,
  onRemoveAngle,
  onUpdateAngleName,
}) => {
  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          映像
        </Typography>
        <Button startIcon={<AddIcon />} onClick={onAddAngle} variant="text">
          追加
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          {angles.map((angle, index) => {
            const fileName = angle.filePath
              ? angle.filePath.split('/').pop()
              : '未選択';
            const roleLabel =
              index === 0
                ? 'メイン（自動）'
                : index === 1
                  ? 'セカンダリ（自動）'
                  : '';
            return (
              <Box
                key={angle.id}
                sx={{
                  borderBottom:
                    index !== angles.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  pb: index !== angles.length - 1 ? 2 : 0,
                  mb: index !== angles.length - 1 ? 2 : 0,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <TextField
                    size="small"
                    label="アングル"
                    value={angle.name}
                    onChange={(e) =>
                      onUpdateAngleName(angle.id, e.target.value)
                    }
                    sx={{ minWidth: 180 }}
                  />
                  {roleLabel && (
                    <Chip
                      label={roleLabel}
                      color={index === 0 ? 'primary' : 'info'}
                      size="small"
                    />
                  )}
                  <IconButton
                    aria-label="アングルを削除"
                    disabled={angles.length === 1}
                    onClick={() => onRemoveAngle(angle.id)}
                    size="small"
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{ mt: 1.5 }}
                >
                  <Button
                    variant="outlined"
                    onClick={() => onSelectVideo(angle.id)}
                  >
                    {angle.filePath ? '変更' : '選択'}
                  </Button>
                  {angle.filePath ? (
                    <Chip
                      label={fileName}
                      color={
                        index === 0
                          ? 'primary'
                          : index === 1
                            ? 'info'
                            : 'default'
                      }
                      variant="outlined"
                      sx={{ maxWidth: 260 }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No media
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            先頭がメイン、2番目がセカンダリとして扱われます。
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
};
