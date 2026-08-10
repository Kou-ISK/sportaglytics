import React, { Dispatch, SetStateAction } from 'react';
import { SyncedVideoPlayer } from './SyncedVideoPlayer';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { PackageMediaAngle } from '../../../../types/package/metadata';

interface VideoPlayerProps {
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
  setMediaAngles?: React.Dispatch<React.SetStateAction<PackageMediaAngle[]>>;
  onPrimaryPlaybackTimeChange?: (timeSeconds: number) => void;
  onPrimaryPlaybackEnded?: () => void;
}

export const VideoPlayer = ({
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
  onPrimaryPlaybackTimeChange,
  onPrimaryPlaybackEnded,
}: VideoPlayerProps): React.JSX.Element => {
  return (
    <SyncedVideoPlayer
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
      onPrimaryPlaybackTimeChange={onPrimaryPlaybackTimeChange}
      onPrimaryPlaybackEnded={onPrimaryPlaybackEnded}
    />
  );
};
