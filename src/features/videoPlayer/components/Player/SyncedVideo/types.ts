import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../types/video/sync';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';

export interface SyncedVideoPlayerProps {
  videoList: string[];
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  syncData?: VideoSyncData;
  syncMode?: 'auto' | 'manual';
  forceUpdateKey?: number;
  viewMode?: 'dual' | 'angle1' | 'angle2';
  currentTime?: number;
  mediaAngles?: PackageMediaAngle[];
  setMediaAngles?: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  onPrimaryPlaybackTimeChange?: (timeSeconds: number) => void;
  onPrimaryPlaybackEnded?: () => void;
}
