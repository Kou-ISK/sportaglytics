import React from 'react';
import { VideoControllerToolbar } from './VideoController/VideoControllerToolbar';
import type { VideoControllerProps } from './VideoController/VideoController.types';
import { useVideoControllerController } from './VideoController/hooks/useVideoControllerController';

export const VideoController = ({
  setIsVideoPlaying,
  isVideoPlaying,
  setVideoPlayBackRate,
  videoPlayBackRate,
  setCurrentTime,
  currentTime,
  handleCurrentTime,
  maxSec,
  videoList,
  syncData,
}: VideoControllerProps) => {
  const toolbarProps = useVideoControllerController({
    setVideoPlayBackRate,
    setIsVideoPlaying,
    isVideoPlaying,
    videoPlayBackRate,
    setCurrentTime,
    currentTime,
    handleCurrentTime,
    syncData,
    maxSec,
    videoList,
  });

  return <VideoControllerToolbar {...toolbarProps} />;
};
