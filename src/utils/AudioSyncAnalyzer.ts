// 音声波形分析ユーティリティ

import { AudioAnalysisResult, WaveformData } from '../types/VideoSync';

export class AudioSyncAnalyzer {
  private audioContext: AudioContext;

  constructor() {
    type ExtendedWindow = Window & {
      webkitAudioContext?: typeof AudioContext;
    };

    const extendedWindow = window as ExtendedWindow;
    const AudioContextCtor =
      window.AudioContext ?? extendedWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error('Web Audio API is not supported in this environment.');
    }

    this.audioContext = new AudioContextCtor();
  }

  /**
   * 映像ファイルから音声データを抽出
   */
  async extractAudioFromVideo(videoPath: string): Promise<WaveformData> {
    try {
      // ファイルパスを適切なURLに変換
      const fileUrl = videoPath.startsWith('file://')
        ? videoPath
        : `file://${videoPath}`;

      // fetch APIを使用してファイルを読み込み
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0); // モノラル音声として処理
      const peaks = this.generatePeaks(channelData, 1000); // 1000サンプルのピーク

      return {
        audioBuffer,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        peaks,
      };
    } catch (error) {
      console.error('音声抽出エラー:', error);
      throw error;
    }
  }

  /**
   * 波形のピーク値を生成
   */
  private generatePeaks(
    channelData: Float32Array,
    peakCount: number,
  ): number[] {
    const peaks: number[] = [];
    const blockSize = Math.floor(channelData.length / peakCount);

    for (let i = 0; i < peakCount; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      let peak = 0;

      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > peak) {
          peak = abs;
        }
      }
      peaks.push(peak);
    }

    return peaks;
  }

  /**
   * 2つの音声波形の相関分析による同期点検出
   */
  async analyzeSyncOffset(
    waveform1: WaveformData,
    waveform2: WaveformData,
    maxOffsetSeconds = 30,
  ): Promise<AudioAnalysisResult> {
    try {
      const maxOffsetSamples = Math.floor(
        maxOffsetSeconds * waveform1.sampleRate,
      );
      const data1 = waveform1.audioBuffer.getChannelData(0);
      const data2 = waveform2.audioBuffer.getChannelData(0);

      let bestOffset = 0;
      let bestCorrelation = -1;

      // クロスコリレーション分析
      for (
        let offset = -maxOffsetSamples;
        offset <= maxOffsetSamples;
        offset += 100
      ) {
        const correlation = this.calculateCorrelation(data1, data2, offset);
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      }

      const offsetSeconds = bestOffset / waveform1.sampleRate;
      const confidence = Math.min(bestCorrelation * 2, 1); // 信頼度を0-1に正規化

      return {
        offsetSeconds,
        confidence,
        correlationPeak: bestCorrelation,
      };
    } catch (error) {
      console.error('同期分析エラー:', error);
      throw error;
    }
  }

  /**
   * 2つの音声データの相関係数を計算
   */
  private calculateCorrelation(
    data1: Float32Array,
    data2: Float32Array,
    offset: number,
  ): number {
    const length = Math.min(data1.length, data2.length - Math.abs(offset));
    const sampleCount = Math.min(length, 44100 * 5); // 最大5秒分のサンプル

    if (sampleCount <= 0) return 0;

    let sum1 = 0,
      sum2 = 0,
      sum1Sq = 0,
      sum2Sq = 0,
      pSum = 0;

    for (let i = 0; i < sampleCount; i++) {
      const idx1 = offset >= 0 ? i : i - offset;
      const idx2 = offset >= 0 ? i + offset : i;

      if (
        idx1 < 0 ||
        idx1 >= data1.length ||
        idx2 < 0 ||
        idx2 >= data2.length
      ) {
        continue;
      }

      const val1 = data1[idx1];
      const val2 = data2[idx2];

      sum1 += val1;
      sum2 += val2;
      sum1Sq += val1 * val1;
      sum2Sq += val2 * val2;
      pSum += val1 * val2;
    }

    const num = pSum - (sum1 * sum2) / sampleCount;
    const den = Math.sqrt(
      (sum1Sq - (sum1 * sum1) / sampleCount) *
        (sum2Sq - (sum2 * sum2) / sampleCount),
    );

    return den === 0 ? 0 : num / den;
  }

  /**
   * 実際の音声波形による高精度同期分析
   * シンプルなクロスコリレーション分析で音声波形が一致する点を見つける
   */
  async quickSyncAnalysis(
    videoPath1: string,
    videoPath2: string,
    onProgress?: (stage: string, progress: number) => void,
  ): Promise<AudioAnalysisResult> {
    console.log('音声同期分析を開始:', { videoPath1, videoPath2 });

    try {
      // ステップ1: 音声抽出 (0-40%)
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

      // ステップ2: 相関分析 (40-100%)
      onProgress?.('同期点を計算中...', 50);

      // シンプルなクロスコリレーション分析
      const result = await this.simpleCorrelationAnalysis(
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
      // エラーの場合はデフォルト値を返す
      return {
        offsetSeconds: 0,
        confidence: 0.5,
        correlationPeak: 0.3,
      };
    }
  }

  /**
   * シンプルなクロスコリレーション分析
   * 冒頭の音声波形を使って最も相関が高いオフセットを見つける
   */
  private async simpleCorrelationAnalysis(
    waveform1: WaveformData,
    waveform2: WaveformData,
    onProgress?: (progress: number) => void,
  ): Promise<AudioAnalysisResult> {
    const data1 = waveform1.audioBuffer.getChannelData(0);
    const data2 = waveform2.audioBuffer.getChannelData(0);
    const sampleRate = waveform1.sampleRate;

    // 分析パラメータ
    const maxOffsetSeconds = 30; // 最大±30秒のズレを検出
    const maxOffsetSamples = Math.floor(maxOffsetSeconds * sampleRate);

    // 分析に使用する音声の長さ（冒頭20秒 - より長い区間で精度向上）
    const analysisLengthSeconds = 20;
    const analysisLengthSamples = Math.floor(
      analysisLengthSeconds * sampleRate,
    );

    console.log('クロスコリレーション分析開始:', {
      maxOffsetSeconds,
      analysisLengthSeconds,
      sampleRate,
      data1Length: data1.length,
      data2Length: data2.length,
    });

    let bestOffset = 0;
    let bestCorrelation = -Infinity;

    // 粗探索: 0.02秒（約0.6フレーム）単位で探索 - より細かく
    const coarseStep = Math.floor(sampleRate * 0.02); // 0.02秒
    console.log(
      '粗探索開始: step =',
      coarseStep,
      'samples (',
      ((coarseStep / sampleRate) * 1000).toFixed(1),
      'ms)',
    );
    onProgress?.(0);

    let searchCount = 0;
    const totalSearches = Math.floor((maxOffsetSamples * 2) / coarseStep);

    for (
      let offset = -maxOffsetSamples;
      offset <= maxOffsetSamples;
      offset += coarseStep
    ) {
      const correlation = this.calculateSimpleCorrelation(
        data1,
        data2,
        offset,
        analysisLengthSamples,
      );

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
        console.log('新しい最良オフセット:', {
          offsetSamples: bestOffset,
          offsetSeconds: (bestOffset / sampleRate).toFixed(3),
          correlation: bestCorrelation.toFixed(4),
        });
      }

      searchCount++;
      if (searchCount % 100 === 0) {
        onProgress?.((searchCount / totalSearches) * 0.4);
      }
    }

    console.log('粗探索完了:', {
      offsetSamples: bestOffset,
      offsetSeconds: (bestOffset / sampleRate).toFixed(3),
      correlation: bestCorrelation.toFixed(4),
      searchCount,
    });

    onProgress?.(0.5);

    // 精密探索: ±2秒の範囲を1フレーム（1/30秒）単位で探索 - より広い範囲で
    const fineStep = Math.floor(sampleRate / 30); // 1フレーム
    const fineRange = Math.floor(sampleRate * 2); // ±2秒
    let refinedOffset = bestOffset;
    let refinedCorrelation = bestCorrelation;

    console.log('精密探索開始:', {
      centerOffset: bestOffset,
      fineStep,
      fineRange,
      searchRange: `${((bestOffset - fineRange) / sampleRate).toFixed(2)}s to ${((bestOffset + fineRange) / sampleRate).toFixed(2)}s`,
    });

    for (
      let offset = bestOffset - fineRange;
      offset <= bestOffset + fineRange;
      offset += fineStep
    ) {
      const correlation = this.calculateSimpleCorrelation(
        data1,
        data2,
        offset,
        analysisLengthSamples,
      );

      if (correlation > refinedCorrelation) {
        refinedCorrelation = correlation;
        refinedOffset = offset;
        console.log('精密探索で改善:', {
          offsetSamples: refinedOffset,
          offsetSeconds: (refinedOffset / sampleRate).toFixed(3),
          correlation: refinedCorrelation.toFixed(4),
        });
      }
    }

    console.log('精密探索完了:', {
      offsetSamples: refinedOffset,
      offsetSeconds: (refinedOffset / sampleRate).toFixed(3),
      offsetFrames:
        ((refinedOffset / sampleRate) * 30).toFixed(2) + ' frames @ 30fps',
      offsetMs: Math.round((refinedOffset / sampleRate) * 1000) + 'ms',
      correlation: refinedCorrelation.toFixed(4),
      improvement: (refinedCorrelation - bestCorrelation).toFixed(4),
    });

    onProgress?.(0.8);

    // 超精密探索: ±0.2秒の範囲をサンプル単位で探索（約0.02ms精度） - より広範囲で最適点を探す
    const ultraFineRange = Math.floor(sampleRate * 0.2); // ±0.2秒
    let finalOffset = refinedOffset;
    let finalCorrelation = refinedCorrelation;

    console.log('超精密探索開始:', {
      centerOffset: refinedOffset,
      ultraFineRange,
      searchRange: `${((refinedOffset - ultraFineRange) / sampleRate).toFixed(4)}s to ${((refinedOffset + ultraFineRange) / sampleRate).toFixed(4)}s`,
      stepSize: '1 sample',
    });

    for (
      let offset = refinedOffset - ultraFineRange;
      offset <= refinedOffset + ultraFineRange;
      offset++ // サンプル単位
    ) {
      const correlation = this.calculateSimpleCorrelation(
        data1,
        data2,
        offset,
        analysisLengthSamples,
      );

      if (correlation > finalCorrelation) {
        finalCorrelation = correlation;
        finalOffset = offset;
      }
    }

    console.log('超精密探索完了:', {
      offsetSamples: finalOffset,
      offsetSeconds: (finalOffset / sampleRate).toFixed(6),
      offsetFrames:
        ((finalOffset / sampleRate) * 30).toFixed(4) + ' frames @ 30fps',
      offsetMs: ((finalOffset / sampleRate) * 1000).toFixed(3) + 'ms',
      correlation: finalCorrelation.toFixed(6),
      improvement: (finalCorrelation - refinedCorrelation).toFixed(6),
      totalImprovement: (finalCorrelation - bestCorrelation).toFixed(6),
    });

    onProgress?.(1);

    const offsetSeconds = finalOffset / sampleRate;
    // 相関係数は-1から1の範囲なので、0から1にマッピング
    const confidence = Math.max(0, Math.min(1, (finalCorrelation + 1) / 2));

    return {
      offsetSeconds,
      confidence,
      correlationPeak: finalCorrelation,
    };
  }

  /**
   * シンプルな相関係数計算
   * 指定されたオフセットでの2つの音声データの相関を計算
   *
   * オフセットの定義（シンプルに）:
   * offset > 0: video1をoffsetサンプル分「遅らせる」必要がある
   *            = video2が先に始まっている
   *            = video1[0]とvideo2[offset]を比較
   * offset < 0: video1を|offset|サンプル分「進める」必要がある
   *            = video1が先に始まっている
   *            = video1[|offset|]とvideo2[0]を比較
   *
   * 返されるoffsetSecondsの意味:
   * offsetSeconds > 0: video2がvideo1より早く始まっている → video1に+offsetSecondsを加える
   * offsetSeconds < 0: video1がvideo2より早く始まっている → video1に-|offsetSeconds|を加える
   */
  private calculateSimpleCorrelation(
    data1: Float32Array,
    data2: Float32Array,
    offset: number,
    analysisLength: number,
  ): number {
    let sum1 = 0;
    let sum2 = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    let productSum = 0;
    let validSamples = 0;

    // 比較範囲を計算
    const start1 = Math.max(0, -offset);
    const start2 = Math.max(0, offset);
    const maxLength = Math.min(
      analysisLength,
      data1.length - start1,
      data2.length - start2,
    );

    if (maxLength <= 0) {
      // デバッグ: 範囲エラーの詳細
      if (offset === 0 || Math.abs(offset) < 100) {
        console.warn('相関計算: 範囲不正', {
          offset,
          start1,
          start2,
          maxLength,
          data1Length: data1.length,
          data2Length: data2.length,
        });
      }
      return -1;
    }

    for (let i = 0; i < maxLength; i++) {
      const idx1 = start1 + i;
      const idx2 = start2 + i;

      if (idx1 >= data1.length || idx2 >= data2.length) {
        break;
      }

      const val1 = data1[idx1];
      const val2 = data2[idx2];
      sum1 += val1;
      sum2 += val2;
      sum1Sq += val1 * val1;
      sum2Sq += val2 * val2;
      productSum += val1 * val2;
      validSamples++;
    }

    if (validSamples === 0) return -1;

    // ピアソン相関係数を計算
    const mean1 = sum1 / validSamples;
    const mean2 = sum2 / validSamples;
    const variance1 = sum1Sq / validSamples - mean1 * mean1;
    const variance2 = sum2Sq / validSamples - mean2 * mean2;

    if (variance1 <= 0 || variance2 <= 0) return -1;

    const covariance = productSum / validSamples - mean1 * mean2;
    const correlation = covariance / Math.sqrt(variance1 * variance2);

    return correlation;
  }

  /**
   * AudioContextのクリーンアップ
   */
  dispose(): void {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
