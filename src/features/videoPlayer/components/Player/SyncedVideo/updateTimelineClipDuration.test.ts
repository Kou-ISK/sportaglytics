import { describe, expect, it } from 'vitest';
import { updateTimelineClipDuration } from './updateTimelineClipDuration';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';

const makeAngles = (): PackageMediaAngle[] => [0, 1].map((i) => ({
  id: `angle-${i}`, name: `angle-${i}`, sourceKind: 'local',
  clips: [{ id: `clip-${i}`, sourceKind: 'local', source: `/media/${i}.mp4`,
    gapBeforeSeconds: 0, timelineStartSeconds: 0, durationSeconds: 10 }],
}));

describe('timeline duration updates', () => {
  it('preserves the timeline owner when metadata reports the same duration', () => {
    const angles = makeAngles();
    expect(updateTimelineClipDuration(angles, 0, 'clip-0', 10)).toBe(angles);
    expect(updateTimelineClipDuration(angles, 1, 'missing', 10)).toBe(angles);
    expect(updateTimelineClipDuration(angles, 4, 'clip-0', 10)).toBe(angles);
  });
  it('publishes a genuinely changed duration without replacing the other angle', () => {
    const angles = makeAngles();
    const next = updateTimelineClipDuration(angles, 0, 'clip-0', 12);
    expect(next).not.toBe(angles);
    expect(next[0].clips[0].durationSeconds).toBe(12);
    expect(next[1]).toBe(angles[1]);
  });
});
