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
  | 'timelineRows'
  | 'selectedTimelineIdList'
  | 'teamNames'
  | 'setSelectedTimelineIdList'
  | 'deleteTimelineDatas'
  | 'updateMemo'
  | 'updateTimelineRange'
  | 'updateTimelineItem'
  | 'bulkUpdateTimelineItems'
  | 'duplicateTimelineItem'
  | 'addTimelineData'
  | 'addTimelineRow'
  | 'updateTimelineRow'
  | 'moveTimelineRow'
  | 'deleteTimelineRows'
  | 'pasteTimelineItemsToRow'
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
  openWizardRequestKey: number;
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
  timelineRows,
  selectedTimelineIdList,
  teamNames,
  setSelectedTimelineIdList,
  deleteTimelineDatas,
  updateMemo,
  updateTimelineRange,
  updateTimelineItem,
  bulkUpdateTimelineItems,
  duplicateTimelineItem,
  addTimelineData,
  addTimelineRow,
  updateTimelineRow,
  moveTimelineRow,
  deleteTimelineRows,
  pasteTimelineItemsToRow,
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
  openWizardRequestKey,
}: VideoPlayerLayoutProps) => {
  return isFileSelected ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        // 小さいウィンドウでもプレイヤー領域を 0px にしない。
        // タイムラインはビューポートに追従しつつ、過度に映像を圧迫しない。
        gridTemplateRows: 'minmax(120px, 1fr) clamp(96px, 30vh, 320px)',
        flex: 1,
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        maxWidth: '100vw',
        overflowY: 'auto',
        overflowX: 'hidden',
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
        timelineRows={timelineRows}
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
        addTimelineData={addTimelineData}
        addTimelineRow={addTimelineRow}
        updateTimelineRow={updateTimelineRow}
        moveTimelineRow={moveTimelineRow}
        deleteTimelineRows={deleteTimelineRows}
        pasteTimelineItemsToRow={pasteTimelineItemsToRow}
        videoList={videoList}
        handleCurrentTime={handleCurrentTime}
        performUndo={performUndo}
        performRedo={performRedo}
        onAddToPlaylist={onAddToPlaylist}
      />
    </Box>
  ) : (
    <NoSelectionPlaceholder
      openWizardRequestKey={openWizardRequestKey}
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
