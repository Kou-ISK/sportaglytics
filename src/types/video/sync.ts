export interface VideoSyncData {
  syncOffset: number;
  angleOffsets?: number[];
  isAnalyzed: boolean;
  waveformData?: Float32Array;
  confidenceScore?: number;
}

export interface AudioAnalysisResult {
  offsetSeconds: number;
  confidence: number;
  correlationPeak: number;
  secondBestCorrelation?: number;
  consistencyScore?: number;
  usableWindowCount?: number;
}

export interface WaveformData {
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  peaks: number[];
}
