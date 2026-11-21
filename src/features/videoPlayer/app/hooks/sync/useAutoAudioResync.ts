import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoPlayerError } from '../../../../../types/video/error';
import type { VideoSyncData } from '../../../../../types/video/sync';
import { shouldApplyAutoAudioSync } from '../../../shared/audioSyncDecision';
import {
  extractAudioWavForSyncBase64,
  readBinaryFileBase64,
} from '../../gateways/syncGateway';

interface UseAutoAudioResyncParams {
  videoList: string[];
  metaDataConfigFilePath: string;
  syncData: VideoSyncData | undefined;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData, isCurrent?: () => boolean) => Promise<void>;
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
  metaDataConfigFilePath,
  syncData,
  setSyncData,
  forceUpdateVideoPlayers,
  onSyncError,
  onSyncInfo,
  onSyncWarning,
}: UseAutoAudioResyncParams): UseAutoAudioResyncResult => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStage, setSyncStage] = useState('');

  const generation = useRef(0);
  const editRevision = useRef(0);
  const ownWrite = useRef<VideoSyncData | null>(null);

  // A committed manual edit supersedes the analysis and its delayed player update.
  useLayoutEffect(() => {
    if (syncData !== ownWrite.current) editRevision.current++;
    ownWrite.current = null;
  }, [syncData]);

  useLayoutEffect(() => {
    setIsAnalyzing(false);
    setSyncProgress(0);
    setSyncStage('');
    return () => { generation.current++; };
  }, [metaDataConfigFilePath, videoList]);

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
    if (videoList.some((source) => /^https?:\/\//i.test(source))) {
      notifyWarning(
        'YouTube 映像は自動音声同期に対応していません。手動同期を利用してください。',
      );
      return;
    }
    if (videoList.length < 2) {
      notifyWarning('2つの映像が必要です');
      return;
    }
    const primaryVideoPath = videoList[0];
    const secondaryVideoPath = videoList[1];
    if (!primaryVideoPath || !secondaryVideoPath) {
      notifyWarning('同期対象の映像パスが見つかりません');
      return;
    }
    if (primaryVideoPath === secondaryVideoPath) {
      notifyWarning('同期対象に別々の映像を指定してください');
      return;
    }

    const request = ++generation.current;
    const revision = editRevision.current;
    const isCurrent = (): boolean =>
      generation.current === request && editRevision.current === revision;
    setIsAnalyzing(true);
    setSyncProgress(0);
    setSyncStage('');

    try {
      const [{ runAudioSyncAnalysis }, { decodeBase64ToArrayBuffer }] =
        await Promise.all([
          import('../../../../../utils/AudioSyncAnalyzer'),
          import('../../../../../utils/audioSync/audioDecode'),
        ]);

      if (!isCurrent()) return;
      const readFileAsArrayBuffer = async (
        videoPath: string,
      ): Promise<ArrayBuffer> => {
        if (!isCurrent()) throw new Error('AUDIO_ANALYSIS_CANCELLED');
        const base64Data =
          (await extractAudioWavForSyncBase64(videoPath)) ??
          (await readBinaryFileBase64(videoPath));
        if (!base64Data) {
          throw new Error(`Failed to read video file: ${videoPath}`);
        }
        return decodeBase64ToArrayBuffer(base64Data);
      };

      notifyInfo('音声同期を再実行中...');
      const result = await runAudioSyncAnalysis({
        videoPath1: primaryVideoPath,
        videoPath2: secondaryVideoPath,
        readFileAsArrayBuffer,
        onProgress: (stage: string, progress: number) => {
          if (!isCurrent()) return;
          setSyncStage(stage);
          setSyncProgress(progress);
        },
      });

      if (!isCurrent()) return;
      setSyncProgress(100);
      if (!shouldApplyAutoAudioSync(result)) {
        notifyWarning(
          '音声同期の信頼度が低いため自動配置を変更しませんでした。手動同期で確認してください。',
        );
        return;
      }

      const newSyncData: VideoSyncData = {
        ...syncData,
        syncOffset: result.offsetSeconds,
        angleOffsets: videoList.map((_, index) => {
          if (index === 0) return 0;
          if (index === 1) return result.offsetSeconds;
          return syncData?.angleOffsets?.[index] ?? syncData?.syncOffset ?? 0;
        }),
        isAnalyzed: true,
        confidenceScore: result.confidence,
      };
      ownWrite.current = newSyncData;
      setSyncData(newSyncData);
      notifyInfo('音声同期完了');
      await forceUpdateVideoPlayers(newSyncData, isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('音声同期エラー:', error);
      onSyncError?.({
        type: 'sync',
        message: '音声同期に失敗しました。',
        recoveryHint:
          '映像ファイルに音声が含まれているか確認し、問題がなければもう一度自動同期を実行してください。',
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (generation.current === request) {
        setIsAnalyzing(false);
        setSyncProgress(0);
        setSyncStage('');
      }
    }
  }, [
    forceUpdateVideoPlayers,
    notifyInfo,
    notifyWarning,
    onSyncError,
    setSyncData,
    syncData,
    videoList,
  ]);

  const resetSync = useCallback((): void => {
    const request = ++generation.current;
    setIsAnalyzing(false);
    setSyncProgress(0);
    setSyncStage('');
    const angleOffsets = syncData?.angleOffsets?.map((offset, index) => index === 1 ? 0 : offset);
    const resetSyncData: VideoSyncData = {
      syncOffset: 0,
      angleOffsets,
      isAnalyzed: Boolean(angleOffsets?.some((offset) => offset !== 0)),
      confidenceScore: 0,
    };
    const revision = editRevision.current;
    ownWrite.current = resetSyncData;
    setSyncData(resetSyncData);
    notifyInfo('同期をリセットしました');
    void forceUpdateVideoPlayers(resetSyncData, () =>
      generation.current === request && editRevision.current === revision,
    );
  }, [
    forceUpdateVideoPlayers,
    notifyInfo,
    setSyncData,
    syncData?.angleOffsets,
  ]);

  return {
    isAnalyzing,
    syncProgress,
    syncStage,
    resyncAudio,
    resetSync,
  };
};
