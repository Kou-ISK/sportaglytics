import type { VideoViewMode } from '../../../../shared/media/angleView';
import React, { Dispatch, SetStateAction } from 'react';
import { SyncedVideoPlayer } from './SyncedVideoPlayer';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { PackageMediaAngle } from '../../../../types/package/metadata';

interface VideoPlayerProps {
  captureActive?: boolean;
  videoList: string[];
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  syncData?: VideoSyncData;
  syncMode?: 'auto' | 'manual';
  forceUpdateKey?: number;
  viewMode?: VideoViewMode;
  currentTime?: number;
  mediaAngles?: PackageMediaAngle[];
  setMediaAngles?: React.Dispatch<React.SetStateAction<PackageMediaAngle[]>>;
}

export const VideoPlayer = ({
  captureActive,
  videoList,
  isVideoPlaying,
  videoPlayBackRate,
  setMaxSec,
  syncData,
  syncMode = 'auto',
  forceUpdateKey = 0,
  viewMode = 'dual',
  currentTime = 0,
  mediaAngles = [],
  setMediaAngles,
}: VideoPlayerProps): React.JSX.Element => {
  return (
    <SyncedVideoPlayer
      captureActive={captureActive}
      videoList={videoList}
      isVideoPlaying={isVideoPlaying}
      videoPlayBackRate={videoPlayBackRate}
      setMaxSec={setMaxSec}
      syncData={syncData}
      syncMode={syncMode}
      forceUpdateKey={forceUpdateKey}
      viewMode={viewMode}
      currentTime={currentTime}
      mediaAngles={mediaAngles}
      setMediaAngles={setMediaAngles}
    />
  );
};
