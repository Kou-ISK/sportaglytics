import { describe, expect, it } from 'vitest';
import { adjacentSyncFrame } from './angleSyncFrames';
describe('frame nudges', () => {
  it('steps from the displayed frame after a scrub, including variable intervals', () => {
    const frames = [0, 0.04, 0.08, 0.1, 0.12];
    expect(adjacentSyncFrame(frames, 0.079, -1)).toBe(0);
    expect(adjacentSyncFrame(frames, 0.079, 1)).toBe(0.08);
    expect(adjacentSyncFrame(frames, 0.0801, 1)).toBe(0.1);
    expect(adjacentSyncFrame(frames, 0.1001, -1)).toBe(0.08);
    expect(adjacentSyncFrame(frames, 0, -1)).toBeUndefined();
    expect(adjacentSyncFrame(frames, 0.12, 1)).toBeUndefined();
  });
});
