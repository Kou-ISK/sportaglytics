import React from 'react';
import { Box } from '@mui/material';
import { VideoPlayer } from '../../../features/videoPlayer/components/Player/VideoPlayer';
import { VideoController } from '../../../features/videoPlayer/components/Controls/VideoController';
import { VideoSyncData } from '../../../types/VideoSync';

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
}) => {
  return (
    <Box
      sx={{
        gridColumn: '1',
        gridRow: '1',
        position: 'relative',
        height: '100%',
        minHeight: 0,
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
        }}
      >
        <VideoPlayer
          key={videoList.join('|')}
          videoList={videoList}
          isVideoPlaying={isVideoPlaying}
          videoPlayBackRate={videoPlayBackRate}
          currentTime={currentTime}
          setMaxSec={setMaxSec}
          syncData={syncData}
          syncMode={syncMode}
          forceUpdateKey={playerForceUpdateKey}
          viewMode={viewMode}
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
            syncData={syncData}
          />
        </Box>
      )}
    </Box>
  );
};
