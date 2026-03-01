import React from 'react';
import { Paper } from '@mui/material';
import { VideoPathSelector } from '../../../features/videoPlayer';
import { VideoSyncData } from '../../../types/VideoSync';

interface NoSelectionPlaceholderProps {
  setVideoList: React.Dispatch<React.SetStateAction<string[]>>;
  setIsFileSelected: React.Dispatch<React.SetStateAction<boolean>>;
  setTimelineFilePath: React.Dispatch<React.SetStateAction<string>>;
  setPackagePath: React.Dispatch<React.SetStateAction<string>>;
  setMetaDataConfigFilePath: React.Dispatch<React.SetStateAction<string>>;
  setSyncData: React.Dispatch<React.SetStateAction<VideoSyncData | undefined>>;
}

export const NoSelectionPlaceholder: React.FC<NoSelectionPlaceholderProps> = (
  props,
) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      p: 0,
      overflow: 'auto',
    }}
  >
    <VideoPathSelector {...props} />
  </Paper>
);
