import { Box } from '@mui/material';
import type { RefObject } from 'react';
import type { TimelineData } from '../../../types/TimelineData';
import type { useVideoPlayerApp } from '../../../hooks/useVideoPlayerApp';
import { ManualSyncControls } from './ManualSyncControls';
import { NoSelectionPlaceholder } from './NoSelectionPlaceholder';
import { PlayerSurface } from './PlayerSurface';
import {
  TimelineActionSection,
  type TimelineActionSectionHandle,
} from './TimelineActionSection';

type VideoPlayerAppState = ReturnType<typeof useVideoPlayerApp>;

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
  | 'metaDataConfigFilePath'
  | 'teamNames'
  | 'setSelectedTimelineIdList'
  | 'setTeamNames'
  | 'addTimelineData'
  | 'deleteTimelineDatas'
  | 'updateMemo'
  | 'updateTimelineRange'
  | 'updateTimelineItem'
  | 'bulkUpdateTimelineItems'
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
  metaDataConfigFilePath,
  teamNames,
  setSelectedTimelineIdList,
  setTeamNames,
  addTimelineData,
  deleteTimelineDatas,
  updateMemo,
  updateTimelineRange,
  updateTimelineItem,
  bulkUpdateTimelineItems,
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
}: VideoPlayerLayoutProps) => {
  return isFileSelected ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto minmax(250px, 1fr)',
        flex: 1,
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
        metaDataConfigFilePath={metaDataConfigFilePath}
        teamNames={teamNames}
        setSelectedTimelineIdList={setSelectedTimelineIdList}
        setTeamNames={setTeamNames}
        addTimelineData={addTimelineData}
        deleteTimelineDatas={deleteTimelineDatas}
        updateMemo={updateMemo}
        updateTimelineRange={updateTimelineRange}
        updateTimelineItem={updateTimelineItem}
        bulkUpdateTimelineItems={bulkUpdateTimelineItems}
        videoList={videoList}
        handleCurrentTime={handleCurrentTime}
        performUndo={performUndo}
        performRedo={performRedo}
        applyLabelsToTimeline={(ids, labels) => {
          if (!ids || ids.length === 0) return;
          ids.forEach((id) => {
            const target = timeline.find((t) => t.id === id);
            const current = target?.labels || [];
            const merged = [...current];
            labels.forEach((label) => {
              if (
                !merged.find(
                  (existing) =>
                    existing.group === label.group && existing.name === label.name,
                )
              ) {
                merged.push(label);
              }
            });
            if (bulkUpdateTimelineItems) {
              bulkUpdateTimelineItems([id], { labels: merged });
            } else {
              updateTimelineItem(id, { labels: merged });
            }
          });
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
