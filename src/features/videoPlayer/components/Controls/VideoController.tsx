import { useContext } from 'react';
import type { ReactElement } from 'react';
import { NativePlaybackControlsContext } from '../NativePlayback/NativePlaybackControlsContext';
import { NativePlaybackPanelView } from '../NativePlayback/NativePlaybackPanelView';
import { ShortcutGuide } from '../../../../components/ShortcutGuide';
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
  useTimelineClock,
}: VideoControllerProps): ReactElement => {
  const audio = useContext(NativePlaybackControlsContext);
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
    useTimelineClock,
  });

  return (
    <VideoControllerToolbar
      {...toolbarProps}
      shortcutGuide={<ShortcutGuide />}
      audioControls={audio && <NativePlaybackPanelView {...audio} />}
    />
  );
};
