import type { VideoViewMode } from '../../../../shared/media/angleView';
import React from 'react';
import { Box } from '@mui/material';
import { VideoPlayer, VideoController } from '../..';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import {
  getAngleOffset,
  getMediaTimelineEnd,
} from '../../../../shared/media/mediaTimeline';

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
  viewMode: VideoViewMode;
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
  const useTimelineClock =
    syncMode === 'auto' && mediaAngles.some((angle) => angle.clips.length > 0);
  const timelineEnd = React.useMemo(
    () =>
      Math.max(
        0,
        ...mediaAngles.map((angle, index) =>
          getMediaTimelineEnd({
            clips: angle.clips,
            offsetSeconds: getAngleOffset(syncData, index),
          }),
        ),
      ),
    [mediaAngles, syncData],
  );
  const timelineDurationsKnown = mediaAngles.every((angle) =>
    angle.clips.every((clip) => typeof clip.durationSeconds === 'number'),
  );

  React.useEffect(() => {
    if (useTimelineClock && timelineEnd > 0) {
      setMaxSec(timelineEnd);
    }
  }, [timelineEnd, setMaxSec, useTimelineClock]);

  React.useEffect(() => {
    if (!useTimelineClock || !isVideoPlaying) return;
    let animationFrameId = 0;
    let previousTimestamp: number | undefined;
    const updateClock = (timestamp: number): void => {
      if (previousTimestamp !== undefined) {
        const elapsed = Math.max(0, timestamp - previousTimestamp) / 1000;
        setCurrentTime((value) => {
          const next = Math.min(86_400, value + elapsed * videoPlayBackRate);
          if (
            timelineDurationsKnown &&
            timelineEnd > 0 &&
            next >= timelineEnd
          ) {
            setIsVideoPlaying(false);
            return timelineEnd;
          }
          return next;
        });
      }
      previousTimestamp = timestamp;
      animationFrameId = globalThis.requestAnimationFrame(updateClock);
    };
    animationFrameId = globalThis.requestAnimationFrame(updateClock);
    return () => globalThis.cancelAnimationFrame(animationFrameId);
  }, [
    isVideoPlaying,
    setCurrentTime,
    setIsVideoPlaying,
    timelineDurationsKnown,
    timelineEnd,
    useTimelineClock,
    videoPlayBackRate,
  ]);

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
            useTimelineClock={useTimelineClock}
          />
        </Box>
      )}
    </Box>
  );
};
