import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../types/VideoSync';

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

export interface PlayerState {
  videoTime: number;
  videoAspectRatios: number[];
}

export interface SyncDerivedState {
  adjustedCurrentTimes: number[];
  blockPlayStates: boolean[];
}

export interface AspectRatioChangeHandler {
  (index: number, ratio: number): void;
}
