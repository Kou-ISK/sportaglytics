import React, { Dispatch, SetStateAction } from 'react';
import { SyncedVideoPlayer } from './SyncedVideoPlayer';
import { VideoSyncData } from '../../../../types/VideoSync';

interface VideoPlayerProps {
  videoList: string[];
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  currentTime: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  syncData?: VideoSyncData;
  syncMode?: 'auto' | 'manual';
  forceUpdateKey?: number;
}

export const VideoPlayer = ({
  videoList,
  isVideoPlaying,
  videoPlayBackRate,
  currentTime,
  setMaxSec,
  syncData,
  syncMode = 'auto',
  forceUpdateKey = 0,
}: VideoPlayerProps) => {
  // currentTimeはシークバー表示用にのみ使用（Video.js自身が時刻管理）
  void currentTime;

  // [DEBUG] VideoPlayer での props を確認
  console.log('[VideoPlayer] Render:', {
    videoListLength: videoList?.length,
    syncMode,
    forceUpdateKey,
  });

  return (
    <SyncedVideoPlayer
      videoList={videoList}
      isVideoPlaying={isVideoPlaying}
      videoPlayBackRate={videoPlayBackRate}
      setMaxSec={setMaxSec}
      syncData={syncData}
      syncMode={syncMode}
      forceUpdateKey={forceUpdateKey}
    />
  );
};
