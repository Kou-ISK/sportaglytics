import { expect, it } from 'vitest';
import { withClipDuration } from './withClipDuration';
import type { PackageMediaClip } from '../../types/package/metadata';
it('places unmeasured remote clips contiguously as metadata arrives, preserving explicit synchronized gaps', () => {
  const clips: PackageMediaClip[] = ['A', 'B', 'C'].map((id) => ({
    id,
    sourceKind: 'youtube',
    source: `https://youtu.be/${id}`,
    timelineStartSeconds: 0,
    gapBeforeSeconds: 0,
  }));
  const first = withClipDuration(clips, 'A', 30);
  expect(first.map((clip) => clip.timelineStartSeconds)).toEqual([0, 30, 30]);
  expect(
    withClipDuration(first, 'B', 10).map((clip) => clip.timelineStartSeconds),
  ).toEqual([0, 30, 40]);
  const aligned = [
    { ...clips[0], durationSeconds: 30 },
    { ...clips[1], timelineStartSeconds: 45 },
  ];
  expect(withClipDuration(aligned, 'A', 30.04)[1].timelineStartSeconds).toBe(
    45,
  );
});
