import { describe, expect, it } from 'vitest';
import {
  getAngleOffset,
  getMediaTimelineEnd,
  resolveMediaTime,
} from './mediaTimeline';
import { calculateTimelineStart } from '../../types/package/clipTimeline';
const clips = [
  { id: 'C', source: 'C.mp4', timelineStartSeconds: 1, durationSeconds: 6 },
  { id: 'D', source: 'D.mp4', timelineStartSeconds: 8, durationSeconds: 6 },
];
describe('shared media clock', () => {
  it('resolves independent first/second half positions with the signed angle correction', () => {
    const timeline = { clips, offsetSeconds: 2 };
    expect(resolveMediaTime(timeline, 0.5)).toMatchObject({
      clip: { id: 'C' },
      sourceTime: 1.5,
      sourceTimeOffset: 1,
    });
    expect(resolveMediaTime(timeline, 5.5)).toBeNull();
    expect(resolveMediaTime(timeline, 6)).toMatchObject({
      clip: { id: 'D' },
      sourceTime: 0,
    });
    expect(resolveMediaTime(timeline, 9)).toMatchObject({
      clip: { id: 'D' },
      sourceTime: 3,
      globalEnd: 12,
    });
    expect(resolveMediaTime(timeline, 12)).toBeNull();
    expect(getMediaTimelineEnd(timeline)).toBe(12);
  });
  it('keeps negative corrections as a leading gap and retains the complete tail', () => {
    const timeline = { clips, offsetSeconds: -2 };
    expect(resolveMediaTime(timeline, 2.9)).toBeNull();
    expect(resolveMediaTime(timeline, 3)?.sourceTime).toBe(0);
    expect(getMediaTimelineEnd(timeline)).toBe(16);
  });
  it('applies per-angle and legacy corrections only when synchronization is enabled', () => {
    const sync = { syncOffset: -4, angleOffsets: [0, 2, 5], isAnalyzed: true };
    expect([0, 1, 2, 3].map((index) => getAngleOffset(sync, index))).toEqual([
      0, 2, 5, -4,
    ]);
    expect(getAngleOffset({ ...sync, isAnalyzed: false }, 1)).toBe(0);
  });
  it('places the selected pair on the same global frame without applying the angle correction twice', () => {
    expect(
      calculateTimelineStart({
        referenceStartSeconds: 6,
        referenceCurrentSeconds: 3,
        targetCurrentSeconds: 1,
        referenceOffsetSeconds: 0,
        targetOffsetSeconds: 2,
      }),
    ).toBe(10);
    expect(
      calculateTimelineStart({
        referenceStartSeconds: 8,
        referenceCurrentSeconds: 3,
        targetCurrentSeconds: 1,
        referenceOffsetSeconds: 2,
        targetOffsetSeconds: 0,
      }),
    ).toBe(8);
  });
});
