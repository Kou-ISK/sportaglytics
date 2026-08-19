import type { AudioAnalysisResult } from '../../../types/video/sync';

export const AUTO_AUDIO_SYNC_MIN_CONFIDENCE = 0.35;

export const shouldApplyAutoAudioSync = (
  result: AudioAnalysisResult,
): boolean =>
  Number.isFinite(result.offsetSeconds) &&
  Number.isFinite(result.confidence) &&
  result.confidence >= AUTO_AUDIO_SYNC_MIN_CONFIDENCE;
