import { useCallback, useState } from 'react';
import { VideoSyncData } from '../../../../../../types/VideoSync';
import { SyncStatus } from '../types';

interface UseAudioSyncOptions {
  setSyncData: (value: VideoSyncData | undefined) => void;
}

const INITIAL_STATUS: SyncStatus = {
  isAnalyzing: false,
  syncProgress: 0,
  syncStage: '',
};

export const useAudioSync = ({ setSyncData }: UseAudioSyncOptions) => {
  const [status, setStatus] = useState<SyncStatus>(INITIAL_STATUS);

  const performAudioSync = useCallback(
    async (tightPath: string, widePath: string): Promise<VideoSyncData> => {
      setStatus({ isAnalyzing: true, syncProgress: 0, syncStage: '' });

      try {
        const { AudioSyncAnalyzer } = await import(
          '../../../../../../utils/AudioSyncAnalyzer'
        );
        const analyzer = new AudioSyncAnalyzer();
        const syncResult = await analyzer.quickSyncAnalysis(
          tightPath,
          widePath,
          (stage, progress) => {
            setStatus({
              isAnalyzing: true,
              syncProgress: progress,
              syncStage: stage,
            });
          },
        );

        const syncData: VideoSyncData = {
          syncOffset: syncResult.offsetSeconds,
          isAnalyzed: true,
          confidenceScore: syncResult.confidence,
        };

        setSyncData(syncData);
        setStatus({ isAnalyzing: true, syncProgress: 100, syncStage: '完了' });
        return syncData;
      } catch (error) {
        console.error('音声同期分析エラー:', error);
        const errorData: VideoSyncData = {
          syncOffset: 0,
          isAnalyzed: false,
          confidenceScore: 0,
        };
        setSyncData(errorData);
        return errorData;
      } finally {
        setStatus(INITIAL_STATUS);
      }
    },
    [setSyncData],
  );

  return { performAudioSync, status };
};
