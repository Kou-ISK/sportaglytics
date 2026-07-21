import React from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/GridLegacy';
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
  } = props;
  const isManualMode = props.syncMode === 'manual';
  const safeVideoList = Array.isArray(videoList) ? videoList : [];
  const allowSeek = isManualMode;
  const offset = syncData?.syncOffset ?? 0;
  const resolveOffset = React.useCallback(
    (index: number): number =>
      index === 0 ? 0 : (syncData?.angleOffsets?.[index] ?? offset),
    [offset, syncData?.angleOffsets],
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
  const gridColumns =
    visibleVideoCount <= 1 ? 12 : visibleVideoCount <= 4 ? 6 : 4;
  const gridRows = Math.max(
    1,
    Math.ceil(visibleVideoCount / (12 / gridColumns)),
  );
  const gridItemHeight = `${100 / gridRows}%`;

  // useSyncedVideoPlayer は全てのモードで常に呼び出す（React Hooks のルール）
  const { blockPlayStates, handleAspectRatioChange } = useSyncedVideoPlayer({
    videoList: safeVideoList,
    isVideoPlaying,
    videoPlayBackRate,
    setMaxSec,
    syncData,
    syncMode: isManualMode ? 'manual' : 'auto',
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

  if (isManualMode) {
    return (
      <Grid
        container
        spacing={0}
        sx={{
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          alignItems: 'start',
          position: 'relative',
        }}
      >
        {safeVideoList.map((filePath, index) => {
          if (!filePath || filePath.trim() === '') {
            return null;
          }

          const isVisible = isIndexVisible(index);

          return (
            <Grid
              key={`${filePath}-${index}`}
              item
              xs={12}
              md={gridColumns}
              sx={{
                padding: 0,
                height: gridItemHeight,
                minHeight: 0,
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
                <MemoizedSingleVideoPlayer
                  videoSrc={filePath}
                  id={`video_${index}`}
                  isVideoPlaying={isVideoPlaying}
                  videoPlayBackRate={videoPlayBackRate}
                  setMaxSec={index === 0 ? setMaxSec : noopSetMax}
                  blockPlay={false}
                  allowSeek
                  forceUpdate={forceUpdateKey}
                  offsetSeconds={resolveOffset(index)}
                  onAspectRatioChange={(ratio) =>
                    handleAspectRatioChange(index, ratio)
                  }
                />
              </Box>
            </Grid>
          );
        })}
      </Grid>
    );
  }

  return (
    <Grid
      container
      spacing={0}
      sx={{
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        alignItems: 'start',
        position: 'relative',
      }}
    >
      {safeVideoList.map((filePath, index) => {
        if (!filePath || filePath.trim() === '') {
          return null;
        }

        const isVisible = isIndexVisible(index);

        return (
          <Grid
            key={`${filePath}-${index}`}
            item
            xs={12}
            md={gridColumns}
            sx={{
              padding: 0,
              height: gridItemHeight,
              minHeight: 0,
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
              <MemoizedSingleVideoPlayer
                videoSrc={filePath}
                id={`video_${index}`}
                isVideoPlaying={isVideoPlaying}
                videoPlayBackRate={videoPlayBackRate}
                setMaxSec={index === 0 ? setMaxSec : noopSetMax}
                blockPlay={blockPlayStates[index] ?? false}
                allowSeek={allowSeek}
                forceUpdate={forceUpdateKey}
                offsetSeconds={resolveOffset(index)}
                onAspectRatioChange={(ratio) =>
                  handleAspectRatioChange(index, ratio)
                }
              />
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
};
