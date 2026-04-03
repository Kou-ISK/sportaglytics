import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoPlayerError } from '../../../../../types/VideoPlayerError';
import type { VideoSyncData } from '../../../../../types/VideoSync';

interface UseAutoAudioResyncParams {
  videoList: string[];
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData) => Promise<void>;
  onSyncError?: (value: VideoPlayerError) => void;
  onSyncInfo?: (message: string) => void;
  onSyncWarning?: (message: string) => void;
}

interface UseAutoAudioResyncResult {
  isAnalyzing: boolean;
  syncProgress: number;
  syncStage: string;
  resyncAudio: () => Promise<void>;
  resetSync: () => void;
}

export const useAutoAudioResync = ({
  videoList,
  setSyncData,
  forceUpdateVideoPlayers,
  onSyncError,
  onSyncInfo,
  onSyncWarning,
}: UseAutoAudioResyncParams): UseAutoAudioResyncResult => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStage, setSyncStage] = useState('');

  const notifyInfo = useCallback(
    (message: string): void => {
      if (onSyncInfo) {
        onSyncInfo(message);
      }
    },
    [onSyncInfo],
  );

  const notifyWarning = useCallback(
    (message: string): void => {
      if (onSyncWarning) {
        onSyncWarning(message);
      }
    },
    [onSyncWarning],
  );

  const resyncAudio = useCallback(async (): Promise<void> => {
    if (videoList.length < 2) {
      notifyWarning('2つの映像が必要です');
      return;
    }

    setIsAnalyzing(true);
    setSyncProgress(0);
    setSyncStage('');

    try {
      const [{ runAudioSyncAnalysis }, { decodeBase64ToArrayBuffer }] =
        await Promise.all([
          import('../../../../../utils/AudioSyncAnalyzer'),
          import('../../../../../utils/audioSync/audioDecode'),
        ]);

      const readFileAsArrayBuffer = async (
        videoPath: string,
      ): Promise<ArrayBuffer> => {
        const base64Data =
          await globalThis.window.electronAPI?.readBinaryFile?.(videoPath);
        if (!base64Data) {
          throw new Error(`Failed to read video file: ${videoPath}`);
        }
        return decodeBase64ToArrayBuffer(base64Data);
      };

      notifyInfo('音声同期を再実行中...');
      const result = await runAudioSyncAnalysis({
        videoPath1: videoList[0] ?? '',
        videoPath2: videoList[1] ?? '',
        readFileAsArrayBuffer,
        onProgress: (stage: string, progress: number) => {
          setSyncStage(stage);
          setSyncProgress(progress);
        },
      });

      const newSyncData: VideoSyncData = {
        syncOffset: result.offsetSeconds,
        isAnalyzed: true,
        confidenceScore: result.confidence,
      };

      setSyncData(newSyncData);
      setSyncProgress(100);
      notifyInfo('音声同期完了');

      await forceUpdateVideoPlayers(newSyncData);
    } catch (error) {
      console.error('音声同期エラー:', error);
      onSyncError?.({
        type: 'sync',
        message:
          '音声同期に失敗しました。映像ファイルに音声が含まれているか確認してください。',
      });
    } finally {
      setIsAnalyzing(false);
      setSyncProgress(0);
      setSyncStage('');
    }
  }, [
    forceUpdateVideoPlayers,
    notifyInfo,
    notifyWarning,
    onSyncError,
    setSyncData,
    videoList,
  ]);

  const resetSync = useCallback((): void => {
    const resetSyncData: VideoSyncData = {
      syncOffset: 0,
      isAnalyzed: false,
      confidenceScore: 0,
    };
    setSyncData(resetSyncData);
    notifyInfo('同期をリセットしました');
    void forceUpdateVideoPlayers(resetSyncData);
  }, [forceUpdateVideoPlayers, notifyInfo, setSyncData]);

  return {
    isAnalyzing,
    syncProgress,
    syncStage,
    resyncAudio,
    resetSync,
  };
};
