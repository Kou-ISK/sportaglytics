import type React from 'react';
import type { VideoSyncData } from '../../../../../types/VideoSync';

export interface VideoControllerProps {
  setIsVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isVideoPlaying: boolean;
  setVideoPlayBackRate: React.Dispatch<React.SetStateAction<number>>;
  videoPlayBackRate: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  currentTime: number;
  handleCurrentTime: (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
  maxSec: number;
  videoList: string[];
  syncData?: VideoSyncData;
}
