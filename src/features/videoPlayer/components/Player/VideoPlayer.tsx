import React, { Dispatch, SetStateAction } from 'react';
import { SyncedVideoPlayer } from './SyncedVideoPlayer';
import type { VideoSyncData } from '../../../../types/VideoSync';

interface VideoPlayerProps {
  videoList: string[];
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  syncData?: VideoSyncData;
  syncMode?: 'auto' | 'manual';
  forceUpdateKey?: number;
  viewMode?: 'dual' | 'angle1' | 'angle2';
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
    />
  );
};
