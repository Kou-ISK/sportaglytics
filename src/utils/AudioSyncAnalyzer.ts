import type { AudioAnalysisResult, WaveformData } from '../types/VideoSync';
import { extractWaveformFromVideo, createAudioContext } from './audioSync/audioDecode';
import {
  analyzeSyncOffsetByCorrelation,
  runQuickCorrelationAnalysis,
} from './audioSync/correlationAnalysis';

export class AudioSyncAnalyzer {
  private readonly audioContext: AudioContext;

  constructor() {
    this.audioContext = createAudioContext();
  }

  async extractAudioFromVideo(videoPath: string): Promise<WaveformData> {
    try {
      return await extractWaveformFromVideo(this.audioContext, videoPath);
    } catch (error) {
      console.error('音声抽出エラー:', error);
      throw error;
    }
  }

  async analyzeSyncOffset(
    waveform1: WaveformData,
    waveform2: WaveformData,
    maxOffsetSeconds = 30,
  ): Promise<AudioAnalysisResult> {
    try {
      return await analyzeSyncOffsetByCorrelation(
        waveform1,
        waveform2,
        maxOffsetSeconds,
      );
    } catch (error) {
      console.error('同期分析エラー:', error);
      throw error;
    }
  }

  async quickSyncAnalysis(
    videoPath1: string,
    videoPath2: string,
    onProgress?: (stage: string, progress: number) => void,
  ): Promise<AudioAnalysisResult> {
    console.log('音声同期分析を開始:', { videoPath1, videoPath2 });

    try {
      onProgress?.('音声抽出中 (映像1)...', 10);
      const waveform1 = await this.extractAudioFromVideo(videoPath1);

      onProgress?.('音声抽出中 (映像2)...', 30);
      const waveform2 = await this.extractAudioFromVideo(videoPath2);

      console.log('音声抽出完了:', {
        video1: {
          duration: waveform1.duration,
          sampleRate: waveform1.sampleRate,
          samples: waveform1.audioBuffer.length,
        },
        video2: {
          duration: waveform2.duration,
          sampleRate: waveform2.sampleRate,
          samples: waveform2.audioBuffer.length,
        },
      });

      onProgress?.('同期点を計算中...', 50);
      const result = await runQuickCorrelationAnalysis(
        waveform1,
        waveform2,
        (progress) => {
          onProgress?.('同期点を計算中...', 50 + progress * 0.5);
        },
      );

      onProgress?.('分析完了', 100);
      console.log('音声同期分析完了:', result);

      return result;
    } catch (error) {
      console.error('音声同期分析エラー:', error);
      return {
        offsetSeconds: 0,
        confidence: 0.5,
        correlationPeak: 0.3,
      };
    }
  }

  dispose(): void {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
