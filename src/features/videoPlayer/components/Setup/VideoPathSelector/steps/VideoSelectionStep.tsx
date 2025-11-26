import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface VideoSelectionStepProps {
  isAnalyzing: boolean;
  selectedTightVideo: string;
  selectedWideVideo: string;
  onSelectVideo: (type: 'tight' | 'wide') => void;
}

/**
 * Step 3: 寄り/引き映像の選択
 */
export const VideoSelectionStep: React.FC<VideoSelectionStepProps> = ({
  isAnalyzing,
  selectedTightVideo,
  selectedWideVideo,
  onSelectVideo,
}) => {
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        <AlertTitle>映像ファイルを選択してください</AlertTitle>
        寄り映像は必須、引き映像は任意です
      </Alert>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          寄り映像 (必須)
        </Typography>
        <Button
          variant="outlined"
          onClick={() => onSelectVideo('tight')}
          fullWidth
          sx={{ mb: 1 }}
          disabled={isAnalyzing}
        >
          {selectedTightVideo ? '再選択' : '選択'}
        </Button>
        {selectedTightVideo && (
          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'success.light' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleIcon color="success" fontSize="small" />
              <Typography variant="caption" noWrap>
                {selectedTightVideo.split('/').pop()}
              </Typography>
            </Stack>
          </Paper>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          引き映像 (任意)
        </Typography>
        <Button
          variant="outlined"
          onClick={() => onSelectVideo('wide')}
          fullWidth
          sx={{ mb: 1 }}
          disabled={isAnalyzing}
        >
          {selectedWideVideo ? '再選択' : '選択'}
        </Button>
        {selectedWideVideo && (
          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'success.light' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleIcon color="success" fontSize="small" />
              <Typography variant="caption" noWrap>
                {selectedWideVideo.split('/').pop()}
              </Typography>
            </Stack>
          </Paper>
        )}
      </Box>
    </Stack>
  );
};
