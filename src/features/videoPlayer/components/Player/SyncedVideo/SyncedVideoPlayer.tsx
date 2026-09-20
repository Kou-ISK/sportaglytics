import { angleIndexForView } from '../../../../../shared/media/angleView';
import { withClipDuration } from '../../../../../shared/media/withClipDuration';
import {
  getAngleOffset,
  resolveMediaTime,
} from '../../../../../shared/media/mediaTimeline';
import { videoGridAspect } from '../../../../../shared/hooks/videoGridAspect';
import { useVideoWindowAspect } from '../../../../../shared/hooks/useVideoWindowAspect';
import React from 'react';
import { Box } from '@mui/material';
import { MemoizedSingleVideoPlayer } from '../SingleVideoPlayer';
import { useSyncedVideoPlayer } from './hooks/useSyncedVideoPlayer';
import type { SyncedVideoPlayerProps } from './types';

const noopSetMax: React.Dispatch<React.SetStateAction<number>> = (value) => {
  void value;
};

export const SyncedVideoPlayer: React.FC<SyncedVideoPlayerProps> = (props) => {
  const {
    videoList,
    isVideoPlaying,
    videoPlayBackRate,
    setMaxSec,
    syncData,
    forceUpdateKey = 0,
    viewMode = 'dual',
    currentTime = 0,
    mediaAngles = [],
    setMediaAngles,
  } = props;
  const isManualMode = props.syncMode === 'manual';
  const safeVideoList = Array.isArray(videoList) ? videoList : [];
  const allowSeek = isManualMode;
  const resolveOffset = React.useCallback(
    (index: number): number => getAngleOffset(syncData, index),
    [syncData],
  );
  const timelineClips = React.useMemo(
    () =>
      safeVideoList.map((fallbackSource, index) => {
        const angle = mediaAngles[index];
        if (!angle || !angle.clips.length) {
          return {
            source: fallbackSource,
            clipId: undefined,
            clipTimeSeconds: currentTime,
          };
        }
        const active = resolveMediaTime(
          { clips: angle.clips, offsetSeconds: resolveOffset(index) },
          currentTime,
        );
        return active
          ? {
              source: active.clip.source,
              clipId: active.clip.id,
              clipTimeSeconds: active.sourceTime,
            }
          : { source: '', clipId: undefined, clipTimeSeconds: 0 };
      }),
    [currentTime, mediaAngles, resolveOffset, safeVideoList],
  );
  const effectiveVideoList = timelineClips.map((entry) => entry.source);
  const recordTimelineClipDuration = React.useCallback(
    (
      angleIndex: number,
      clipId: string | undefined,
    ): React.Dispatch<React.SetStateAction<number>> =>
      (value) => {
        if (
          !clipId ||
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value <= 0
        ) {
          return;
        }
        const clipStart =
          mediaAngles[angleIndex]?.clips.find((clip) => clip.id === clipId)
            ?.timelineStartSeconds ?? 0;
        setMaxSec((current) => Math.max(current, clipStart + value));
        setMediaAngles?.((current) =>
          current.map((angle, index) =>
            index !== angleIndex
              ? angle
              : {
                  ...angle,
                  clips: withClipDuration(angle.clips, clipId, value),
                },
          ),
        );
      },
    [mediaAngles, setMaxSec, setMediaAngles],
  );
  const requestedIndex = angleIndexForView(viewMode);
  const selectedIndex =
    requestedIndex !== null && safeVideoList[requestedIndex]?.trim()
      ? requestedIndex
      : null;
  const visibleVideoCount =
    selectedIndex === null
      ? safeVideoList.filter((source) => source?.trim()).length
      : 1;
  const gridColumnCount =
    visibleVideoCount <= 1 ? 1 : visibleVideoCount <= 4 ? 2 : 3;
  const gridRows = Math.max(1, Math.ceil(visibleVideoCount / gridColumnCount));

  // useSyncedVideoPlayer は全てのモードで常に呼び出す（React Hooks のルール）
  const { blockPlayStates, aspectRatios, handleAspectRatioChange } =
    useSyncedVideoPlayer({
      videoList: effectiveVideoList,
      isVideoPlaying,
      videoPlayBackRate,
      setMaxSec,
      syncData,
      syncMode: isManualMode ? 'manual' : 'auto',
      forceUpdateKey,
    });

  // 手動モードでは同期処理を完全にバイパスし、各プレイヤーを独立させる
  const isIndexVisible = (index: number): boolean =>
    selectedIndex === null || index === selectedIndex;

  const mediaRef = React.useRef<HTMLDivElement>(null);
  const visibleRatios = safeVideoList.flatMap((path, index) =>
    path && isIndexVisible(index) ? [aspectRatios[index] ?? 16 / 9] : [],
  );
  useVideoWindowAspect(mediaRef, viewMode, videoGridAspect(visibleRatios));

  const hiddenItemSx = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
    pointerEvents: 'none' as const,
  };

  return (
    <Box
      ref={mediaRef}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {safeVideoList.map((fallbackPath, index) => {
        if (!fallbackPath || fallbackPath.trim() === '') return null;
        const filePath = timelineClips[index]?.source ?? fallbackPath;

        const isVisible = isIndexVisible(index);

        return (
          <Box
            key={`${filePath}-${index}`}
            sx={{
              padding: 0,
              width: '100%',
              height: '100%',
              minHeight: 0,
              minWidth: 0,
              ...(isVisible ? {} : hiddenItemSx),
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: '#000',
              }}
            >
              {filePath ? (
                <MemoizedSingleVideoPlayer
                  videoSrc={filePath}
                  id={`video_${index}`}
                  isVideoPlaying={isVideoPlaying}
                  videoPlayBackRate={videoPlayBackRate}
                  setMaxSec={
                    timelineClips[index]?.clipId
                      ? recordTimelineClipDuration(
                          index,
                          timelineClips[index].clipId,
                        )
                      : index === 0
                        ? setMaxSec
                        : noopSetMax
                  }
                  blockPlay={
                    isManualMode || mediaAngles[index]?.clips.length
                      ? false
                      : (blockPlayStates[index] ?? false)
                  }
                  allowSeek={allowSeek}
                  forceUpdate={forceUpdateKey}
                  timelineTimeSeconds={
                    isManualMode
                      ? undefined
                      : timelineClips[index]?.clipTimeSeconds
                  }
                  initialTimeSeconds={
                    timelineClips[index]?.clipTimeSeconds ?? 0
                  }
                  offsetSeconds={resolveOffset(index)}
                  onAspectRatioChange={(ratio) =>
                    handleAspectRatioChange(index, ratio)
                  }
                />
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
