import React from 'react';
import { Box } from '@mui/material';
import { MemoizedSingleVideoPlayer } from '../SingleVideoPlayer';
import { useSyncedVideoPlayer } from './hooks/useSyncedVideoPlayer';
import type { SyncedVideoPlayerProps } from './types';
import {
  resolveTimelineClip,
  usesVirtualClipTimeline,
} from '../../../../../types/package/clipTimeline';
import {
  clampAngleMediaTime,
  globalTimeToAngleMediaTime,
  resolvePlaybackAngleOffset,
} from '../../../../../types/video/sync';

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
  const syncMode = isManualMode ? 'manual' : 'auto';
  const safeVideoList = Array.isArray(videoList) ? videoList : [];
  const allowSeek = isManualMode;

  const playbackOffsets = React.useMemo(
    () =>
      safeVideoList.map((_, index) =>
        resolvePlaybackAngleOffset({
          syncData,
          angleIndex: index,
          syncMode,
          usesVirtualTimeline: usesVirtualClipTimeline(
            mediaAngles[index]?.clips ?? [],
          ),
        }),
      ),
    [mediaAngles, safeVideoList, syncData, syncMode],
  );

  const playbackSyncData = React.useMemo(
    () =>
      syncData
        ? {
            ...syncData,
            syncOffset: playbackOffsets[1] ?? 0,
            angleOffsets: playbackOffsets,
          }
        : undefined,
    [playbackOffsets, syncData],
  );

  const timelineClips = React.useMemo(
    () =>
      safeVideoList.map((fallbackSource, index) => {
        const angle = mediaAngles[index];
        const usesVirtualTimeline = usesVirtualClipTimeline(angle?.clips ?? []);
        const offset = playbackOffsets[index] ?? 0;

        if (!angle || !usesVirtualTimeline) {
          return {
            source: fallbackSource,
            clipId: undefined,
            clipTimeSeconds: isManualMode
              ? currentTime
              : clampAngleMediaTime(
                  globalTimeToAngleMediaTime(currentTime, offset),
                ),
          };
        }

        // timelineStartSeconds is already absolute on the common timeline.
        // playbackOffsets[index] is therefore guaranteed to be zero here.
        const active = resolveTimelineClip(angle.clips, currentTime);
        return active
          ? {
              source: active.clip.source,
              clipId: active.clip.id,
              clipTimeSeconds: active.clipTimeSeconds,
            }
          : { source: '', clipId: undefined, clipTimeSeconds: 0 };
      }),
    [currentTime, isManualMode, mediaAngles, playbackOffsets, safeVideoList],
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
                  clips: angle.clips.map((clip) =>
                    clip.id === clipId &&
                    Math.abs((clip.durationSeconds ?? 0) - value) > 0.01
                      ? { ...clip, durationSeconds: value }
                      : clip,
                  ),
                },
          ),
        );
      },
    [mediaAngles, setMaxSec, setMediaAngles],
  );
  const hasPrimary = Boolean(safeVideoList[0]?.trim());
  const hasSecondary = Boolean(safeVideoList[1]?.trim());

  const effectiveViewMode = React.useMemo(() => {
    if (viewMode === 'dual') {
      if (!hasSecondary && hasPrimary) return 'angle1';
      if (!hasPrimary && hasSecondary) return 'angle2';
    }
    if (viewMode === 'angle1' && !hasPrimary && hasSecondary) return 'angle2';
    if (viewMode === 'angle2' && !hasSecondary && hasPrimary) return 'angle1';
    return viewMode;
  }, [hasPrimary, hasSecondary, viewMode]);

  const visibleVideoCount =
    effectiveViewMode === 'dual'
      ? safeVideoList.filter((filePath) => filePath && filePath.trim() !== '')
          .length
      : effectiveViewMode === 'angle1'
        ? hasPrimary
          ? 1
          : 0
        : hasSecondary
          ? 1
          : 0;
  const gridColumnCount =
    visibleVideoCount <= 1 ? 1 : visibleVideoCount <= 4 ? 2 : 3;
  const gridRows = Math.max(1, Math.ceil(visibleVideoCount / gridColumnCount));

  // useSyncedVideoPlayer は全てのモードで常に呼び出す（React Hooks のルール）
  const { blockPlayStates, handleAspectRatioChange } = useSyncedVideoPlayer({
    videoList: effectiveVideoList,
    isVideoPlaying,
    videoPlayBackRate,
    setMaxSec,
    syncData: playbackSyncData,
    syncMode,
    forceUpdateKey,
  });

  // 手動モードでは同期処理を完全にバイパスし、各プレイヤーを独立させる
  const isIndexVisible = (index: number) => {
    if (effectiveViewMode === 'dual') return true;
    if (effectiveViewMode === 'angle1') return index === 0;
    return index === 1;
  };

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
                    isManualMode ? false : (blockPlayStates[index] ?? false)
                  }
                  allowSeek={allowSeek}
                  forceUpdate={forceUpdateKey}
                  initialTimeSeconds={
                    timelineClips[index]?.clipTimeSeconds ?? 0
                  }
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
