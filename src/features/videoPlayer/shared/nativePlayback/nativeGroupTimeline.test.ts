import { expect, it } from 'vitest';
import type { PackageMediaAngle } from '../../../../types/package/media';
import {
  resolveNativeGroupTimeline,
  nativeGroupTimelineMatches,
} from './nativeGroupTimeline';
const angles = (): PackageMediaAngle[] =>
  ['left', 'right'].map((id) => ({
    id,
    name: id,
    sourceKind: 'local',
    clips: [
      {
        id: `${id}-clip`,
        sourceKind: 'local',
        source: 'file:///synthetic.mp4',
        gapBeforeSeconds: 0,
        timelineStartSeconds: 0,
        durationSeconds: 10,
      },
    ],
  }));
it('distinguishes equal-URL slots and qualifies only their complete common package', () => {
  const result = resolveNativeGroupTimeline(angles(), undefined);
  expect(result?.slots.map((s) => [s.angleId, s.playerId])).toEqual([
    ['left', 'video_0'],
    ['right', 'video_1'],
  ]);
  const changed = angles();
  changed[1].clips[0].durationSeconds = 11;
  expect(resolveNativeGroupTimeline(changed, undefined)).toBeNull();
});
it('preserves source offsets rather than double applying them to the global clock', () => {
  const input = angles();
  input[1].clips[0].durationSeconds = 12;
  const timeline = resolveNativeGroupTimeline(input, {
    syncOffset: 2,
    isAnalyzed: true,
  });
  expect(timeline?.slots[1].sourceTimeOffset).toBe(2);
  if (!timeline) throw Error('fixture');
  const binding = {
    audioAngleId: 'left',
    angles: timeline.slots.map((slot) => ({
      ...slot,
      globalStart: 0,
      sourceEnd: 12,
      audioTracks: 3,
    })),
  };
  // Build the typed pair explicitly; no presumed tuple length cast.
  expect(
    nativeGroupTimelineMatches(timeline, {
      audioAngleId: 'left',
      angles: [binding.angles[0], binding.angles[1]],
    }),
  ).toBe(true);
  binding.angles[1].clipId = 'replaced';
  expect(
    nativeGroupTimelineMatches(timeline, {
      audioAngleId: 'left',
      angles: [binding.angles[0], binding.angles[1]],
    }),
  ).toBe(false);
});
it('keeps multi-clip, gap, delayed start, duplicate ID, unknown duration and nonlocal input on HTML', () => {
  for (const change of [
    (a: PackageMediaAngle[]) =>
      a[1].clips.push({ ...a[1].clips[0], id: 'second' }),
    (a: PackageMediaAngle[]) => {
      a[1].clips[0].gapBeforeSeconds = 1;
    },
    (a: PackageMediaAngle[]) => {
      a[1].clips[0].timelineStartSeconds = 1;
    },
    (a: PackageMediaAngle[]) => {
      a[1].id = a[0].id;
    },
    (a: PackageMediaAngle[]) => {
      delete a[1].clips[0].durationSeconds;
    },
    (a: PackageMediaAngle[]) => {
      a[1].clips[0].sourceKind = 'youtube';
    },
  ]) {
    const input = angles();
    change(input);
    expect(resolveNativeGroupTimeline(input, undefined)).toBeNull();
  }
});
