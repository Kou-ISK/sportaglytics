import React from 'react';
import {
  Alert,
  AlertTitle,
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
  isAnalyzing: boolean;
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
  isAnalyzing,
  angles,
  onSelectVideo,
  onAddAngle,
  onRemoveAngle,
  onUpdateAngleName,
}) => {
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        <AlertTitle>アングルを追加して映像を割り当て</AlertTitle>
        1つ目に選んだ映像が自動でメイン、2つ目がセカンダリになります。追加のアングルも任意に割り当てられます。
      </Alert>

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
                    label="アングル名"
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
                      variant="outlined"
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
                    disabled={isAnalyzing}
                  >
                    {angle.filePath ? '映像を再選択' : '映像を選択'}
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
                      未選択
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
          <Divider />
          <Button
            startIcon={<AddIcon />}
            onClick={onAddAngle}
            variant="text"
            disabled={isAnalyzing}
            sx={{ alignSelf: 'flex-start' }}
          >
            アングルを追加
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
};
