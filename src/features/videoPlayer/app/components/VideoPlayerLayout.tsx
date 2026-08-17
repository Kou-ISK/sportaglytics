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
  | 'metaDataConfigFilePath'
  | 'setMetaDataConfigFilePath'
  | 'setSyncData'
  | 'mediaAngles'
  | 'setMediaAngles'
> & {
  openWizardRequestKey: number;
  onApplyManualSync: () => void;
  onCancelManualSync: () => void;
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
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  metaDataConfigFilePath,
  setMetaDataConfigFilePath,
  setSyncData,
  mediaAngles,
  setMediaAngles,
  onApplyManualSync,
  onCancelManualSync,
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
            gridRow: '1',
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
