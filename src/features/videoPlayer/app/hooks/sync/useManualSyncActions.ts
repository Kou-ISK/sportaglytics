import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import {
  applySecondarySyncOffset,
  type VideoSyncData,
} from '../../../../../types/video/sync';
import {
  saveSyncData,
  setManualSyncModeChecked,
} from '../../gateways/syncGateway';
import { getManualSyncTimes } from './syncPlayerAdapter';
import { usesClipPlacementSync } from './syncModeGuards';

interface UseManualSyncActionsParams {
  mediaAngles: PackageMediaAngle[];
  syncData: VideoSyncData | undefined;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  metaDataConfigFilePath: string;
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData) => Promise<void>;
  onSyncInfo?: (message: string) => void;
  onSyncWarning?: (message: string) => void;
}

interface UseManualSyncActionsResult {
  adjustSyncOffset: () => Promise<void>;
  manualSyncFromPlayers: () => Promise<void>;
  cancelManualSync: () => Promise<void>;
}

const closeManualMode = async (): Promise<void> => {
  await setManualSyncModeChecked(false);
};

export const useManualSyncActions = ({
  mediaAngles,
  syncData,
  setSyncData,
  metaDataConfigFilePath,
  setSyncMode,
  forceUpdateVideoPlayers,
  onSyncInfo,
  onSyncWarning,
}: UseManualSyncActionsParams): UseManualSyncActionsResult => {
  const notifyInfo = useCallback(
    (message: string): void => {
      onSyncInfo?.(message);
    },
    [onSyncInfo],
  );

  const notifyWarning = useCallback(
    (message: string): void => {
      onSyncWarning?.(message);
    },
    [onSyncWarning],
  );

  const canUseAngleLevelSync = useCallback((): boolean => {
    if (!usesClipPlacementSync(mediaAngles)) {
      return true;
    }
    notifyWarning(
      'クリップ配置済みのアングルはクリップ単位シンクが基準です。クリップ単位シンクで調整してください。',
    );
    return false;
  }, [mediaAngles, notifyWarning]);

  const adjustSyncOffset = useCallback(async (): Promise<void> => {
    if (!syncData || !canUseAngleLevelSync()) {
      return;
    }

    const newOffset = prompt(
      '同期オフセットを入力してください（秒）:',
      syncData.syncOffset.toString(),
    );
    if (newOffset === null || Number.isNaN(Number(newOffset))) {
      return;
    }

    const offsetSeconds = Number(newOffset);
    const adjustedSyncData = applySecondarySyncOffset(
      syncData,
      offsetSeconds,
    );
    setSyncData(adjustedSyncData);
    notifyInfo(`同期オフセットを調整しました: ${offsetSeconds} 秒`);

    await forceUpdateVideoPlayers(adjustedSyncData);
  }, [
    canUseAngleLevelSync,
    forceUpdateVideoPlayers,
    notifyInfo,
    setSyncData,
    syncData,
  ]);

  const manualSyncFromPlayers = useCallback(async (): Promise<void> => {
    if (!canUseAngleLevelSync()) {
      return;
    }

    try {
      const { primaryTime, secondaryTime } = getManualSyncTimes();
      const newOffset = secondaryTime - primaryTime;
      const newSyncData: VideoSyncData = {
        ...applySecondarySyncOffset(syncData, newOffset),
        confidenceScore: undefined,
      };

      setSyncData(newSyncData);
      notifyInfo(`手動同期を適用しました (差分: ${newOffset.toFixed(3)} 秒)`);

      if (metaDataConfigFilePath) {
        await saveSyncData(metaDataConfigFilePath, newSyncData);
      }

      await forceUpdateVideoPlayers(newSyncData);
      setSyncMode('auto');
      await closeManualMode();
    } catch (error) {
      console.error('manualSyncFromPlayers error', error);
    }
  }, [
    canUseAngleLevelSync,
    forceUpdateVideoPlayers,
    metaDataConfigFilePath,
    notifyInfo,
    setSyncData,
    setSyncMode,
    syncData,
  ]);

  const cancelManualSync = useCallback(async (): Promise<void> => {
    setSyncMode('auto');
    await closeManualMode();
  }, [setSyncMode]);

  return {
    adjustSyncOffset,
    manualSyncFromPlayers,
    cancelManualSync,
  };
};
