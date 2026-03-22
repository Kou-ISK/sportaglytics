import type { AudioAnalysisResult, WaveformData } from '../types/VideoSync';
import { extractWaveformFromVideo, createAudioContext } from './audioSync/audioDecode';
import {
  analyzeSyncOffsetByCorrelation,
  runQuickCorrelationAnalysis,
} from './audioSync/correlationAnalysis';

interface AudioSyncAnalysisContext {
  audioContext: AudioContext;
}

interface RunAudioSyncAnalysisParams {
  videoPath1: string;
  videoPath2: string;
  onProgress?: (stage: string, progress: number) => void;
}

export const createAudioSyncAnalysisContext =
  (): AudioSyncAnalysisContext => {
    return {
      audioContext: createAudioContext(),
    };
  };

export const disposeAudioSyncAnalysisContext = (
  context: AudioSyncAnalysisContext,
): void => {
  if (context.audioContext.state !== 'closed') {
    void context.audioContext.close();
  }
};

export const extractAudioWaveform = async (
  context: AudioSyncAnalysisContext,
  videoPath: string,
): Promise<WaveformData> => {
  return extractWaveformFromVideo(context.audioContext, videoPath);
};

export const analyzeAudioSyncOffset = async (
  waveform1: WaveformData,
  waveform2: WaveformData,
  maxOffsetSeconds = 30,
): Promise<AudioAnalysisResult> => {
  return analyzeSyncOffsetByCorrelation(
    waveform1,
    waveform2,
    maxOffsetSeconds,
  );
};

export const runAudioSyncAnalysis = async ({
  videoPath1,
  videoPath2,
  onProgress,
}: RunAudioSyncAnalysisParams): Promise<AudioAnalysisResult> => {
  const context = createAudioSyncAnalysisContext();

  try {
    onProgress?.('音声抽出中 (映像1)...', 10);
    const waveform1 = await extractAudioWaveform(context, videoPath1);

    onProgress?.('音声抽出中 (映像2)...', 30);
    const waveform2 = await extractAudioWaveform(context, videoPath2);

    onProgress?.('同期点を計算中...', 50);
    const result = await runQuickCorrelationAnalysis(
      waveform1,
      waveform2,
      (progress) => {
        onProgress?.('同期点を計算中...', 50 + progress * 0.5);
      },
    );

    onProgress?.('分析完了', 100);
    return result;
  } catch (error) {
    console.error('音声同期分析エラー:', error);
    return {
      offsetSeconds: 0,
      confidence: 0.5,
      correlationPeak: 0.3,
    };
  } finally {
    disposeAudioSyncAnalysisContext(context);
  }
};
