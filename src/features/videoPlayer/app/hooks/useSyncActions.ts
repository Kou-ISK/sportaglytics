import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { VideoPlayerError } from '../../../../types/video/error';
import { useAutoAudioResync } from './sync/useAutoAudioResync';
import { useManualSyncActions } from './sync/useManualSyncActions';
import { useSyncPlayerUpdater } from './sync/useSyncPlayerUpdater';

interface UseSyncActionsParams {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  metaDataConfigFilePath: string;
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  onSyncError?: (value: VideoPlayerError) => void;
  onSyncInfo?: (message: string) => void;
  onSyncWarning?: (message: string) => void;
}

interface UseSyncActionsResult {
  playerForceUpdateKey: number;
  resyncAudio: () => Promise<void>;
  resetSync: () => void;
  adjustSyncOffset: () => Promise<void>;
  manualSyncFromPlayers: () => Promise<void>;
  cancelManualSync: () => Promise<void>;
  isAnalyzing: boolean;
  syncProgress: number;
  syncStage: string;
}

export const useSyncActions = ({
  videoList,
  syncData,
  setSyncData,
  setIsVideoPlaying,
  metaDataConfigFilePath,
  setSyncMode,
  onSyncError,
  onSyncInfo,
  onSyncWarning,
}: UseSyncActionsParams): UseSyncActionsResult => {
  const { playerForceUpdateKey, forceUpdateVideoPlayers } =
    useSyncPlayerUpdater({
      videoList,
      setIsVideoPlaying,
    });

  const logInfo = useCallback(
    (message: string): void => {
      if (onSyncInfo) {
        onSyncInfo(message);
      }
    },
    [onSyncInfo],
  );

  const logWarn = useCallback(
    (message: string): void => {
      if (onSyncWarning) {
        onSyncWarning(message);
      }
    },
    [onSyncWarning],
  );

  const autoAudioResync = useAutoAudioResync({
    videoList,
    setSyncData,
    forceUpdateVideoPlayers,
    onSyncError,
    onSyncInfo: logInfo,
    onSyncWarning: logWarn,
  });
  const manualSyncActions = useManualSyncActions({
    syncData,
    setSyncData,
    metaDataConfigFilePath,
    setSyncMode,
    forceUpdateVideoPlayers,
    onSyncInfo: logInfo,
  });

  return {
    playerForceUpdateKey,
    resyncAudio: autoAudioResync.resyncAudio,
    resetSync: autoAudioResync.resetSync,
    adjustSyncOffset: manualSyncActions.adjustSyncOffset,
    manualSyncFromPlayers: manualSyncActions.manualSyncFromPlayers,
    cancelManualSync: manualSyncActions.cancelManualSync,
    isAnalyzing: autoAudioResync.isAnalyzing,
    syncProgress: autoAudioResync.syncProgress,
    syncStage: autoAudioResync.syncStage,
  };
};
