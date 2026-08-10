import { describe, expect, it } from 'vitest';
import { resolveControllerSeekTarget } from './playbackSyncTiming';

describe('resolveControllerSeekTarget', () => {
  it('does not overwrite clip-local player time when the virtual timeline clock is active', () => {
    expect(
      resolveControllerSeekTarget({
        baseTime: 120,
        offset: 8,
        useTimelineClock: true,
      }),
    ).toBeNull();
  });

  it('applies the synchronization offset by addition for regular playback', () => {
    expect(
      resolveControllerSeekTarget({
        baseTime: 12,
        offset: 3,
        useTimelineClock: false,
      }),
    ).toBe(15);
  });

  it('clamps a negative synchronized target to zero', () => {
    expect(
      resolveControllerSeekTarget({
        baseTime: 2,
        offset: -5,
        useTimelineClock: false,
      }),
    ).toBe(0);
  });
});
