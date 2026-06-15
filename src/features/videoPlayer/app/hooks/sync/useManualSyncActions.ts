import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../types/video/sync';
import {
  saveSyncData,
  setManualSyncModeChecked,
} from '../../gateways/syncGateway';
import { getManualSyncTimes } from './syncPlayerAdapter';

interface UseManualSyncActionsParams {
  syncData: VideoSyncData | undefined;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  metaDataConfigFilePath: string;
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData) => Promise<void>;
  onSyncInfo?: (message: string) => void;
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
  syncData,
  setSyncData,
  metaDataConfigFilePath,
  setSyncMode,
  forceUpdateVideoPlayers,
  onSyncInfo,
}: UseManualSyncActionsParams): UseManualSyncActionsResult => {
  const notifyInfo = useCallback(
    (message: string): void => {
      if (onSyncInfo) {
        onSyncInfo(message);
      }
    },
    [onSyncInfo],
  );

  const adjustSyncOffset = useCallback(async (): Promise<void> => {
    if (!syncData) {
      return;
    }

    const newOffset = prompt(
      '同期オフセットを入力してください（秒）:',
      syncData.syncOffset.toString(),
    );
    if (newOffset === null || Number.isNaN(Number(newOffset))) {
      return;
    }

    const adjustedSyncData: VideoSyncData = {
      ...syncData,
      syncOffset: Number(newOffset),
      isAnalyzed: true,
    };
    setSyncData(adjustedSyncData);
    notifyInfo(`同期オフセットを調整しました: ${Number(newOffset)} 秒`);

    await forceUpdateVideoPlayers(adjustedSyncData);
  }, [forceUpdateVideoPlayers, notifyInfo, setSyncData, syncData]);

  const manualSyncFromPlayers = useCallback(async (): Promise<void> => {
    try {
      const { primaryTime, secondaryTime } = getManualSyncTimes();
      const newOffset = secondaryTime - primaryTime;
      const newSyncData: VideoSyncData = {
        syncOffset: newOffset,
        isAnalyzed: true,
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
    forceUpdateVideoPlayers,
    metaDataConfigFilePath,
    notifyInfo,
    setSyncData,
    setSyncMode,
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
