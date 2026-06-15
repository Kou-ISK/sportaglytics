export interface VideoSyncData {
  syncOffset: number;
  isAnalyzed: boolean;
  waveformData?: Float32Array;
  confidenceScore?: number;
}

export interface AudioAnalysisResult {
  offsetSeconds: number;
  confidence: number;
  correlationPeak: number;
}

export interface WaveformData {
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  peaks: number[];
}
