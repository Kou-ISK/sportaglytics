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

      // より精密な同期分析（複数の時間窓で分析）
      const result = await this.analyzeSyncOffsetMultiWindow(
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
   * マルチウィンドウ方式での同期分析（精度向上版）
   */
  private async analyzeSyncOffsetMultiWindow(
    waveform1: WaveformData,
    waveform2: WaveformData,
    onProgress?: (progress: number) => void,
  ): Promise<AudioAnalysisResult> {
    const data1 = waveform1.audioBuffer.getChannelData(0);
    const data2 = waveform2.audioBuffer.getChannelData(0);
    const sampleRate = waveform1.sampleRate;

    // 分析パラメータの最適化
    const maxOffsetSeconds = 30; // 最大30秒のズレを検出
    const maxOffsetSamples = Math.floor(maxOffsetSeconds * sampleRate);

    // より細かいサンプリング間隔で精度向上（50→25サンプル）
    const stepSize = 25;

    // エネルギーが高い部分を選択的に分析（音のある部分）
    const windowSize = Math.floor(sampleRate * 15); // 15秒のウィンドウ（より長く）
    const analysisWindows = this.selectHighEnergyWindows(
      data1,
      data2,
      windowSize,
      5, // 5つの時間窓を使用（増加）
    );

    console.log('分析パラメータ:', {
      maxOffsetSeconds,
      stepSize,
      windowSize: windowSize / sampleRate,
      numWindows: analysisWindows.length,
    });

    let bestOffset = 0;
    let bestCorrelation = -1;

    // 粗探索: 大きなステップで候補を絞る
    onProgress?.(0.1);
    const coarseStepSize = stepSize * 8; // 8倍のステップで高速探索
    for (
      let offset = -maxOffsetSamples;
      offset <= maxOffsetSamples;
      offset += coarseStepSize
    ) {
      const correlation = this.calculateCorrelationForWindows(
        data1,
        data2,
        offset,
        analysisWindows,
      );

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    console.log('粗探索結果:', {
      bestOffsetSamples: bestOffset,
      bestOffsetSeconds: bestOffset / sampleRate,
      bestCorrelation,
    });

    onProgress?.(0.5);

    // 精密探索: 最良候補の周辺を細かく探索
    const searchRange = coarseStepSize * 2; // 粗探索ステップの2倍の範囲
    let refinedBestOffset = bestOffset;
    let refinedBestCorrelation = bestCorrelation;

    for (
      let offset = bestOffset - searchRange;
      offset <= bestOffset + searchRange;
      offset += stepSize
    ) {
      const correlation = this.calculateCorrelationForWindows(
        data1,
        data2,
        offset,
        analysisWindows,
      );

      if (correlation > refinedBestCorrelation) {
        refinedBestCorrelation = correlation;
        refinedBestOffset = offset;
      }
    }

    console.log('精密探索結果:', {
      refinedBestOffsetSamples: refinedBestOffset,
      refinedBestOffsetSeconds: refinedBestOffset / sampleRate,
      refinedBestCorrelation,
    });

    onProgress?.(0.9);

    // サブサンプル精度での最終調整
    const finalBestOffset = this.refineOffsetSubsample(
      data1,
      data2,
      refinedBestOffset,
      analysisWindows,
      stepSize,
    );

    const offsetSeconds = finalBestOffset / sampleRate;
    const confidence = Math.min(refinedBestCorrelation * 2, 1);

    onProgress?.(1);

    console.log('音声同期分析結果:', {
      offsetSeconds,
      offsetSamples: finalBestOffset,
      confidence,
      correlationPeak: refinedBestCorrelation,
    });

    return {
      offsetSeconds,
      confidence,
      correlationPeak: refinedBestCorrelation,
    };
  }

  /**
   * エネルギーが高い（音がある）時間窓を選択
   */
  private selectHighEnergyWindows(
    data1: Float32Array,
    data2: Float32Array,
    windowSize: number,
    numWindows: number,
  ): Array<{ start: number; end: number }> {
    const minLength = Math.min(data1.length, data2.length);
    const energies: Array<{ start: number; energy: number }> = [];

    // 各ウィンドウのエネルギーを計算（RMS値を使用）
    const overlap = windowSize / 4; // オーバーラップを増やして精度向上
    for (
      let start = 0;
      start < minLength - windowSize;
      start += windowSize - overlap
    ) {
      let sumSquares = 0;
      let count = 0;
      for (let i = start; i < start + windowSize && i < minLength; i++) {
        // 両方の音声のRMS（二乗平均平方根）を使用
        sumSquares += data1[i] * data1[i] + data2[i] * data2[i];
        count++;
      }
      const rmsEnergy = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      energies.push({ start, energy: rmsEnergy });
    }

    // エネルギーが高い順にソート
    energies.sort((a, b) => b.energy - a.energy);

    // 上位のウィンドウを選択（重複を避けるため時間順にソート）
    const selectedWindows = energies
      .slice(0, numWindows)
      .map((e) => ({
        start: e.start,
        end: Math.min(e.start + windowSize, minLength),
      }))
      .sort((a, b) => a.start - b.start);

    console.log('選択された分析ウィンドウ:', {
      windows: selectedWindows.map((w, i) => ({
        index: i,
        startSec: w.start / 44100,
        endSec: w.end / 44100,
        energy: energies.find((e) => e.start === w.start)?.energy,
      })),
      totalWindows: energies.length,
    });
    return selectedWindows;
  }

  /**
   * 複数の時間窓での相関を平均計算
   */
  private calculateCorrelationForWindows(
    data1: Float32Array,
    data2: Float32Array,
    offset: number,
    windows: Array<{ start: number; end: number }>,
  ): number {
    let totalCorrelation = 0;
    let validWindowCount = 0;

    for (const window of windows) {
      const correlation = this.calculateCorrelationInWindow(
        data1,
        data2,
        offset,
        window.start,
        window.end,
      );

      if (!Number.isNaN(correlation) && Number.isFinite(correlation)) {
        totalCorrelation += correlation;
        validWindowCount++;
      }
    }

    return validWindowCount > 0 ? totalCorrelation / validWindowCount : 0;
  }

  /**
   * 特定の時間窓内での相関計算
   */
  private calculateCorrelationInWindow(
    data1: Float32Array,
    data2: Float32Array,
    offset: number,
    windowStart: number,
    windowEnd: number,
  ): number {
    const length = windowEnd - windowStart;
    let sum1 = 0,
      sum2 = 0,
      sum1Sq = 0,
      sum2Sq = 0,
      pSum = 0;
    let validSamples = 0;

    for (let i = 0; i < length; i++) {
      const idx1 = windowStart + i;
      const idx2 = idx1 + offset;

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
      validSamples++;
    }

    if (validSamples === 0) return 0;

    const num = pSum - (sum1 * sum2) / validSamples;
    const den = Math.sqrt(
      (sum1Sq - (sum1 * sum1) / validSamples) *
        (sum2Sq - (sum2 * sum2) / validSamples),
    );

    return den === 0 ? 0 : num / den;
  }

  /**
   * サブサンプル精度での最終調整（補間を使用）
   */
  private refineOffsetSubsample(
    data1: Float32Array,
    data2: Float32Array,
    coarseOffset: number,
    windows: Array<{ start: number; end: number }>,
    stepSize: number,
  ): number {
    const subSteps = 10; // サブサンプルステップ数
    let bestOffset = coarseOffset;
    let bestCorrelation = this.calculateCorrelationForWindows(
      data1,
      data2,
      coarseOffset,
      windows,
    );

    // 前後のstepSizeの範囲をサブサンプル精度で探索
    for (let i = -subSteps; i <= subSteps; i++) {
      const offset = coarseOffset + (i * stepSize) / subSteps;
      const intOffset = Math.floor(offset);
      const frac = offset - intOffset;

      // 線形補間を使った相関計算（近似）
      const corr1 = this.calculateCorrelationForWindows(
        data1,
        data2,
        intOffset,
        windows,
      );
      const corr2 = this.calculateCorrelationForWindows(
        data1,
        data2,
        intOffset + 1,
        windows,
      );
      const interpolatedCorr = corr1 * (1 - frac) + corr2 * frac;

      if (interpolatedCorr > bestCorrelation) {
        bestCorrelation = interpolatedCorr;
        bestOffset = offset;
      }
    }

    return bestOffset;
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
