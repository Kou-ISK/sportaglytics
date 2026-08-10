import { describe, expect, it } from 'vitest';
import { resolvePlaybackDriftCorrectionTarget } from './playbackDrift';

describe('resolvePlaybackDriftCorrectionTarget', () => {
  it('does not seek for normal clock jitter', () => {
    expect(
      resolvePlaybackDriftCorrectionTarget({
        actualTimeSeconds: 10,
        targetTimeSeconds: 10.1,
        durationSeconds: 100,
      }),
    ).toBeNull();
  });

  it('corrects meaningful positive drift', () => {
    expect(
      resolvePlaybackDriftCorrectionTarget({
        actualTimeSeconds: 10,
        targetTimeSeconds: 10.4,
        durationSeconds: 100,
      }),
    ).toBe(10.4);
  });

  it('corrects meaningful negative drift', () => {
    expect(
      resolvePlaybackDriftCorrectionTarget({
        actualTimeSeconds: 10.5,
        targetTimeSeconds: 10,
        durationSeconds: 100,
      }),
    ).toBe(10);
  });

  it('does not seek at or beyond the target media end', () => {
    expect(
      resolvePlaybackDriftCorrectionTarget({
        actualTimeSeconds: 99,
        targetTimeSeconds: 100,
        durationSeconds: 100,
      }),
    ).toBeNull();
  });

  it('ignores invalid targets', () => {
    expect(
      resolvePlaybackDriftCorrectionTarget({
        actualTimeSeconds: 1,
        targetTimeSeconds: null,
        durationSeconds: 100,
      }),
    ).toBeNull();
  });
});
