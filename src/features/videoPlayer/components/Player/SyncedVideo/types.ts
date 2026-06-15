import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../types/video/sync';

export interface SyncedVideoPlayerProps {
  videoList: string[];
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  syncData?: VideoSyncData;
  syncMode?: 'auto' | 'manual';
  forceUpdateKey?: number;
  viewMode?: 'dual' | 'angle1' | 'angle2';
}
