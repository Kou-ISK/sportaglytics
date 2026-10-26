import { expect, it } from 'vitest';
import { resolveMediaDisplayTime } from './mediaDisplayTime';
import { getMediaTimelineEnd, resolveMediaTime } from './mediaTimeline';
const timeline = {
  offsetSeconds: 2,
  clips: [
    {
      id: 'second',
      source: 'second.mp4',
      timelineStartSeconds: 8,
      durationSeconds: 6,
    },
    {
      id: 'first',
      source: 'first.mp4',
      timelineStartSeconds: 1,
      durationSeconds: 6,
    },
  ],
};

it('keeps the terminal frame mounted without changing source or package clocks', () => {
  expect(resolveMediaDisplayTime(timeline, 12)).toEqual({
    clip: timeline.clips[0],
    sourceTime: 6,
    sourceTimeOffset: -6,
    globalEnd: 12,
  });
  expect(resolveMediaTime(timeline, 12)).toBeNull();
  expect(resolveMediaDisplayTime(timeline, 12.000001)).toBeNull();
});
it('preserves leading/internal gaps and the next clip at an adjoining boundary', () => {
  expect(resolveMediaDisplayTime(timeline, -2)).toBeNull();
  expect(resolveMediaDisplayTime(timeline, 5)).toBeNull();
  expect(resolveMediaDisplayTime(timeline, 5.5)).toBeNull();
  expect(resolveMediaDisplayTime(timeline, 6)?.clip.id).toBe('second');
  const adjacent = {
    ...timeline,
    clips: [
      timeline.clips[1],
      { ...timeline.clips[0], timelineStartSeconds: 7 },
    ],
  };
  expect(resolveMediaDisplayTime(adjacent, 5)?.clip.id).toBe('second');
});
it('does not invent an endpoint for an unknown duration', () => {
  expect(
    resolveMediaDisplayTime({ offsetSeconds: 0, clips: [] }, 0),
  ).toBeNull();
  const unknown = {
    offsetSeconds: 0,
    clips: [{ id: 'a', source: 'a.mp4', timelineStartSeconds: 1 }],
  };
  expect(resolveMediaDisplayTime(unknown, 10)?.sourceTime).toBe(9);
});

it('uses the same terminal clock for fractional placement and angle offset', () => {
  const fractional = {
    offsetSeconds: 0.3,
    clips: [
      {
        id: 'a',
        source: 'a.mp4',
        timelineStartSeconds: 0.1,
        durationSeconds: 0.2,
      },
    ],
  };
  const end = getMediaTimelineEnd(fractional);
  expect(resolveMediaDisplayTime(fractional, end)).toMatchObject({
    sourceTime: 0.2,
    globalEnd: end,
  });
});
