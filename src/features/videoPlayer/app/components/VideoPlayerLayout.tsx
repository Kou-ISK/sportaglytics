import type { VideoViewMode } from '../../../../shared/media/angleView';
import type { AngleSyncSession } from '../hooks/sync/useAngleSyncSession';
import { Box } from '@mui/material';
import type { useVideoPlayerScreenController } from '../hooks/useVideoPlayerScreenController';
import { ManualSyncControls } from './ManualSyncControls';
import { NoSelectionPlaceholder } from './NoSelectionPlaceholder';
import { PlayerSurface } from './PlayerSurface';

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
  | 'setVideoList'
  | 'setIsFileSelected'
  | 'setTimelineFilePath'
  | 'setPackagePath'
  | 'setMetaDataConfigFilePath'
  | 'setSyncData'
  | 'mediaAngles'
  | 'setMediaAngles'
> & {
  openWizardRequestKey: number;
  angleSync: AngleSyncSession;
  viewMode: VideoViewMode;
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
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
  mediaAngles,
  setMediaAngles,
  angleSync,
  viewMode,
  openWizardRequestKey,
}: VideoPlayerLayoutProps) => {
  return isFileSelected ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        // 独立タイムラインに高さを奪われず、映像面を常に維持する。
        gridTemplateRows: 'minmax(120px, 1fr)',
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
      {syncMode === 'manual' ? (
        <ManualSyncControls session={angleSync} />
      ) : (
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
      )}
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
