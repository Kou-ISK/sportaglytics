import { describe, expect, it } from 'vitest';
import {
  AUTO_AUDIO_SYNC_MIN_CONFIDENCE,
  shouldApplyAutoAudioSync,
} from './audioSyncDecision';

describe('shouldApplyAutoAudioSync', () => {
  it('accepts finite results at the confidence threshold', () => {
    expect(
      shouldApplyAutoAudioSync({
        offsetSeconds: 45,
        confidence: AUTO_AUDIO_SYNC_MIN_CONFIDENCE,
        correlationPeak: 0.8,
      }),
    ).toBe(true);
  });

  it('rejects low-confidence or non-finite results', () => {
    expect(
      shouldApplyAutoAudioSync({
        offsetSeconds: 45,
        confidence: AUTO_AUDIO_SYNC_MIN_CONFIDENCE - 0.01,
        correlationPeak: 0.8,
      }),
    ).toBe(false);
    expect(
      shouldApplyAutoAudioSync({
        offsetSeconds: Number.NaN,
        confidence: 1,
        correlationPeak: 1,
      }),
    ).toBe(false);
  });
});
