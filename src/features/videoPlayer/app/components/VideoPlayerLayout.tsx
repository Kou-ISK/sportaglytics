import { Box } from '@mui/material';
import type { TimelineData } from '../../../../types/timeline/core';
import type { useVideoPlayerScreenController } from '../hooks/useVideoPlayerScreenController';
import { ManualSyncControls } from './ManualSyncControls';
import { NoSelectionPlaceholder } from './NoSelectionPlaceholder';
import { PlayerSurface } from './PlayerSurface';
import { TimelineActionSection } from './TimelineActionSection';

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
  | 'metaDataConfigFilePath'
  | 'setMetaDataConfigFilePath'
  | 'setSyncData'
  | 'mediaAngles'
  | 'setMediaAngles'
  | 'performUndo'
  | 'performRedo'
> & {
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
  timeline,
  selectedTimelineIdList,
  teamNames,
  setSelectedTimelineIdList,
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
  metaDataConfigFilePath,
  setMetaDataConfigFilePath,
  setSyncData,
  mediaAngles,
  setMediaAngles,
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
        gridTemplateRows: 'minmax(0, 1fr) minmax(160px, 30vh)',
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
        mediaAngles={mediaAngles}
        setMediaAngles={setMediaAngles}
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
            mediaAngles={mediaAngles}
            metaDataConfigFilePath={metaDataConfigFilePath}
            setMediaAngles={setMediaAngles}
            setVideoList={setVideoList}
          />
        </Box>
      )}

      <TimelineActionSection
        timeline={timeline}
        maxSec={maxSec}
        currentTime={currentTime}
        selectedTimelineIdList={selectedTimelineIdList}
        teamNames={teamNames}
        setSelectedTimelineIdList={setSelectedTimelineIdList}
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
      setMediaAngles={setMediaAngles}
    />
  );
};
