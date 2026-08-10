import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { VideoPlayerError } from '../../../../types/video/error';
import { toPersistedSyncData } from '../../shared/packageSyncData';
import { saveSyncData } from '../gateways/syncGateway';
import { useAutoAudioResync } from './sync/useAutoAudioResync';
import { useManualSyncActions } from './sync/useManualSyncActions';
import { useSyncPlayerUpdater } from './sync/useSyncPlayerUpdater';

interface UseSyncActionsParams {
  videoList: string[];
  mediaAngles: PackageMediaAngle[];
  syncData: VideoSyncData | undefined;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  isVideoPlaying: boolean;
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
  mediaAngles,
  syncData,
  setSyncData,
  isVideoPlaying,
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
      mediaAngles,
      isVideoPlaying,
      setIsVideoPlaying,
    });

  const logInfo = useCallback(
    (message: string): void => {
      onSyncInfo?.(message);
    },
    [onSyncInfo],
  );

  const logWarn = useCallback(
    (message: string): void => {
      onSyncWarning?.(message);
    },
    [onSyncWarning],
  );

  const commitSyncData = useCallback(
    async (newSyncData: VideoSyncData): Promise<void> => {
      // Runtime state uses playback order. Persisted angleOffsets must be
      // converted back to config.json angles[] order before writing.
      setSyncData(newSyncData);

      if (metaDataConfigFilePath) {
        const persistedSyncData = toPersistedSyncData(
          newSyncData,
          mediaAngles,
        );
        const saved = await saveSyncData(
          metaDataConfigFilePath,
          persistedSyncData,
        );
        if (!saved) {
          logWarn(
            '同期データをパッケージへ保存できませんでした。現在の画面には反映されています。',
          );
        }
      }

      await forceUpdateVideoPlayers(newSyncData);
    },
    [
      forceUpdateVideoPlayers,
      logWarn,
      mediaAngles,
      metaDataConfigFilePath,
      setSyncData,
    ],
  );

  const autoAudioResync = useAutoAudioResync({
    videoList,
    mediaAngles,
    syncData,
    commitSyncData,
    onSyncError,
    onSyncInfo: logInfo,
    onSyncWarning: logWarn,
  });
  const manualSyncActions = useManualSyncActions({
    mediaAngles,
    syncData,
    setSyncMode,
    commitSyncData,
    onSyncInfo: logInfo,
    onSyncWarning: logWarn,
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
