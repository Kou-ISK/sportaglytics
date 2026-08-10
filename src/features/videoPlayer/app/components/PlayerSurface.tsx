import React from 'react';
import { Box } from '@mui/material';
import { VideoPlayer, VideoController } from '../..';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import { usesVirtualClipTimeline } from '../../../../types/package/clipTimeline';
import { usePrimaryTimelineClock } from '../hooks/usePrimaryTimelineClock';

interface PlayerSurfaceProps {
  videoList: string[];
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setIsVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoPlayBackRate: React.Dispatch<React.SetStateAction<number>>;
  setMaxSec: React.Dispatch<React.SetStateAction<number>>;
  handleCurrentTime: (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
  maxSec: number;
  syncData?: VideoSyncData;
  syncMode: 'auto' | 'manual';
  playerForceUpdateKey: number;
  viewMode: 'dual' | 'angle1' | 'angle2';
  mediaAngles: PackageMediaAngle[];
  setMediaAngles: React.Dispatch<React.SetStateAction<PackageMediaAngle[]>>;
}

export const PlayerSurface: React.FC<PlayerSurfaceProps> = ({
  videoList,
  isVideoPlaying,
  videoPlayBackRate,
  currentTime,
  setCurrentTime,
  setIsVideoPlaying,
  setVideoPlayBackRate,
  setMaxSec,
  handleCurrentTime,
  maxSec,
  syncData,
  syncMode,
  playerForceUpdateKey,
  viewMode,
  mediaAngles,
  setMediaAngles,
}) => {
  const primaryClips = mediaAngles[0]?.clips ?? [];
  const useTimelineClock =
    syncMode === 'auto' && usesVirtualClipTimeline(primaryClips);
  const { onPrimaryPlaybackTimeChange, onPrimaryPlaybackEnded } =
    usePrimaryTimelineClock({
      enabled: useTimelineClock,
      isVideoPlaying,
      videoPlayBackRate,
      currentTime,
      clips: primaryClips,
      setCurrentTime,
      setIsVideoPlaying,
      setMaxSec,
    });

  return (
    <Box
      sx={{
        gridColumn: '1',
        gridRow: '1',
        position: 'relative',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        '&:hover .video-controls-overlay': {
          opacity: 1,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <VideoPlayer
          key={videoList.join('|')}
          videoList={videoList}
          isVideoPlaying={isVideoPlaying}
          videoPlayBackRate={videoPlayBackRate}
          setMaxSec={setMaxSec}
          syncData={syncData}
          syncMode={syncMode}
          currentTime={currentTime}
          mediaAngles={mediaAngles}
          setMediaAngles={setMediaAngles}
          forceUpdateKey={playerForceUpdateKey}
          viewMode={viewMode}
          onPrimaryPlaybackTimeChange={
            useTimelineClock ? onPrimaryPlaybackTimeChange : undefined
          }
          onPrimaryPlaybackEnded={
            useTimelineClock ? onPrimaryPlaybackEnded : undefined
          }
        />
      </Box>

      {/* 自動モードでは共通コントローラーを表示 */}
      {syncMode === 'auto' && (
        <Box
          className="video-controls-overlay"
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            opacity: 0,
            transition: 'opacity 0.3s',
            zIndex: 1000,
          }}
        >
          <VideoController
            setIsVideoPlaying={setIsVideoPlaying}
            isVideoPlaying={isVideoPlaying}
            setVideoPlayBackRate={setVideoPlayBackRate}
            videoPlayBackRate={videoPlayBackRate}
            setCurrentTime={setCurrentTime}
            currentTime={currentTime}
            handleCurrentTime={handleCurrentTime}
            maxSec={maxSec}
            videoList={videoList}
            useTimelineClock={useTimelineClock}
          />
        </Box>
      )}
    </Box>
  );
};
