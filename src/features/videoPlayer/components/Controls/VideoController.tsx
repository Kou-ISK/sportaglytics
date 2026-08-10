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
  useTimelineClock,
}: VideoControllerProps) => {
  const toolbarProps = useVideoControllerController({
    setVideoPlayBackRate,
    setIsVideoPlaying,
    isVideoPlaying,
    videoPlayBackRate,
    setCurrentTime,
    currentTime,
    handleCurrentTime,
    maxSec,
    videoList,
    useTimelineClock,
  });

  return <VideoControllerToolbar {...toolbarProps} />;
};
