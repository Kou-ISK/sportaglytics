import { describe, expect, it } from 'vitest';
import type { PackageMediaClip } from '../../../../types/package/metadata';
import {
  advancePrimaryTimelineClock,
  arePrimaryTimelineDurationsKnown,
  calculatePrimaryTimelineEnd,
} from './primaryTimelineClock';

const clip = (
  id: string,
  timelineStartSeconds: number,
  durationSeconds: number,
): PackageMediaClip => ({
  id,
  sourceKind: 'local',
  source: `/${id}.mp4`,
  gapBeforeSeconds: 0,
  timelineStartSeconds,
  durationSeconds,
});

const clips = [clip('a', 0, 5), clip('b', 10, 5)];

describe('primary virtual timeline clock', () => {
  it('follows observed media time while a clip is active', () => {
    expect(
      advancePrimaryTimelineClock({
        currentGlobalTime: 2,
        elapsedSeconds: 1,
        playbackRate: 1,
        clips,
        observedPrimaryMediaTime: 2.1,
      }),
    ).toBe(2.1);
  });

  it('does not advance through buffering without a media observation', () => {
    expect(
      advancePrimaryTimelineClock({
        currentGlobalTime: 2,
        elapsedSeconds: 1,
        playbackRate: 1,
        clips,
        observedPrimaryMediaTime: null,
      }),
    ).toBe(2);
  });

  it('uses media ended to leave the last decoded frame and enter the gap', () => {
    expect(
      advancePrimaryTimelineClock({
        currentGlobalTime: 4.8,
        elapsedSeconds: 0.016,
        playbackRate: 1,
        clips,
        observedPrimaryMediaTime: 4.9,
        observedPrimaryMediaEnded: true,
      }),
    ).toBe(5);
  });

  it('advances wall-clock time only through a black gap', () => {
    expect(
      advancePrimaryTimelineClock({
        currentGlobalTime: 6,
        elapsedSeconds: 1,
        playbackRate: 2,
        clips,
        observedPrimaryMediaTime: null,
      }),
    ).toBe(8);
  });

  it('lands exactly on the next clip instead of skipping its start', () => {
    expect(
      advancePrimaryTimelineClock({
        currentGlobalTime: 9.5,
        elapsedSeconds: 1,
        playbackRate: 2,
        clips,
        observedPrimaryMediaTime: null,
      }),
    ).toBe(10);
  });

  it('ignores stale player time while a clip source is switching', () => {
    expect(
      advancePrimaryTimelineClock({
        currentGlobalTime: 10,
        elapsedSeconds: 0.016,
        playbackRate: 1,
        clips,
        observedPrimaryMediaTime: 5,
      }),
    ).toBe(10);
  });

  it('derives a stable package end only when durations are known', () => {
    expect(calculatePrimaryTimelineEnd(clips)).toBe(15);
    expect(arePrimaryTimelineDurationsKnown(clips)).toBe(true);
    expect(
      arePrimaryTimelineDurationsKnown([
        { ...clips[0], durationSeconds: undefined },
      ]),
    ).toBe(false);
  });
});
