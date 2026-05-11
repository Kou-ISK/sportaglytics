import { Box } from '@mui/material';
import type { RefObject } from 'react';
import type { TimelineData } from '../../../../types/timeline/core';
import type { useVideoPlayerScreenController } from '../hooks/useVideoPlayerScreenController';
import { ManualSyncControls } from './ManualSyncControls';
import { NoSelectionPlaceholder } from './NoSelectionPlaceholder';
import { PlayerSurface } from './PlayerSurface';
import { buildSelectionLabelUpdates } from '../utils/applyLabelsToTimelineSelection';
import {
  TimelineActionSection,
  type TimelineActionSectionHandle,
} from './TimelineActionSection';

type VideoPlayerAppState = ReturnType<typeof useVideoPlayerScreenController>;

type VideoPlayerLayoutProps = Pick<
  VideoPlayerAppState,
  | 'isFileSelected'
  | 'videoList'
  | 'isVideoPlaying'
  | 'videoPlayBackRate'
  | 'currentTime'
  | 'setCurrentTime'
  | 'setisVideoPlaying'
  | 'setVideoPlayBackRate'
  | 'setMaxSec'
  | 'handleCurrentTime'
  | 'maxSec'
  | 'syncData'
  | 'syncMode'
  | 'playerForceUpdateKey'
  | 'timeline'
  | 'selectedTimelineIdList'
  | 'teamNames'
  | 'setSelectedTimelineIdList'
  | 'addTimelineData'
  | 'deleteTimelineDatas'
  | 'updateMemo'
  | 'updateTimelineRange'
  | 'updateTimelineItem'
  | 'bulkUpdateTimelineItems'
  | 'duplicateTimelineItem'
  | 'setVideoList'
  | 'setIsFileSelected'
  | 'setTimelineFilePath'
  | 'setPackagePath'
  | 'setMetaDataConfigFilePath'
  | 'setSyncData'
  | 'performUndo'
  | 'performRedo'
> & {
  timelineActionRef: RefObject<TimelineActionSectionHandle | null>;
  onApplyManualSync: () => void;
  onCancelManualSync: () => void;
  onAddToPlaylist: (items: TimelineData[]) => Promise<void>;
  viewMode: 'dual' | 'angle1' | 'angle2';
};

export const VideoPlayerLayout = ({
  isFileSelected,
  videoList,
  isVideoPlaying,
  videoPlayBackRate,
  currentTime,
  setCurrentTime,
  setisVideoPlaying,
  setVideoPlayBackRate,
  setMaxSec,
  handleCurrentTime,
  maxSec,
  syncData,
  syncMode,
  playerForceUpdateKey,
  timelineActionRef,
  timeline,
  selectedTimelineIdList,
  teamNames,
  setSelectedTimelineIdList,
  addTimelineData,
  deleteTimelineDatas,
  updateMemo,
  updateTimelineRange,
  updateTimelineItem,
  bulkUpdateTimelineItems,
  duplicateTimelineItem,
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
  performUndo,
  performRedo,
  onApplyManualSync,
  onCancelManualSync,
  onAddToPlaylist,
  viewMode,
}: VideoPlayerLayoutProps) => {
  return isFileSelected ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'minmax(0, 1fr) minmax(250px, 1fr)',
        flex: 1,
        height: '100%',
        minHeight: 0,
      }}
    >
      <PlayerSurface
        videoList={videoList}
        isVideoPlaying={isVideoPlaying}
        videoPlayBackRate={videoPlayBackRate}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        setIsVideoPlaying={setisVideoPlaying}
        setVideoPlayBackRate={setVideoPlayBackRate}
        setMaxSec={setMaxSec}
        handleCurrentTime={handleCurrentTime}
        maxSec={maxSec}
        syncData={syncData}
        syncMode={syncMode}
        playerForceUpdateKey={playerForceUpdateKey}
        viewMode={viewMode}
      />

      {syncMode === 'manual' && (
        <Box
          sx={{
            gridColumn: '1',
            gridRow: '2',
            position: 'relative',
            zIndex: 1100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            pt: 2,
            pointerEvents: 'none',
            '& > *': {
              pointerEvents: 'auto',
            },
          }}
        >
          <ManualSyncControls
            onApplySync={onApplyManualSync}
            onCancel={onCancelManualSync}
          />
        </Box>
      )}

      <TimelineActionSection
        ref={timelineActionRef}
        timeline={timeline}
        maxSec={maxSec}
        currentTime={currentTime}
        selectedTimelineIdList={selectedTimelineIdList}
        teamNames={teamNames}
        setSelectedTimelineIdList={setSelectedTimelineIdList}
        addTimelineData={addTimelineData}
        deleteTimelineDatas={deleteTimelineDatas}
        updateMemo={updateMemo}
        updateTimelineRange={updateTimelineRange}
        updateTimelineItem={updateTimelineItem}
        bulkUpdateTimelineItems={bulkUpdateTimelineItems}
        duplicateTimelineItem={duplicateTimelineItem}
        videoList={videoList}
        handleCurrentTime={handleCurrentTime}
        performUndo={performUndo}
        performRedo={performRedo}
        applyLabelsToTimeline={(ids, labels) => {
          for (const update of buildSelectionLabelUpdates(
            timeline,
            ids,
            labels,
          )) {
            if (bulkUpdateTimelineItems) {
              bulkUpdateTimelineItems([update.id], { labels: update.labels });
            } else {
              updateTimelineItem(update.id, { labels: update.labels });
            }
          }
        }}
        onAddToPlaylist={onAddToPlaylist}
      />
    </Box>
  ) : (
    <NoSelectionPlaceholder
      setVideoList={setVideoList}
      setIsFileSelected={setIsFileSelected}
      setTimelineFilePath={setTimelineFilePath}
      setPackagePath={setPackagePath}
      setMetaDataConfigFilePath={setMetaDataConfigFilePath}
      setSyncData={setSyncData}
    />
  );
};
