import { describe, expect, it } from 'vitest';
import {
  calculateTimelineStart,
  deriveTimelineGaps,
  resolveTimelineClip,
} from './clipTimeline';

describe('clip timeline placement', () => {
  it('creates a 540 second black gap for the A/B/C example', () => {
    const result = deriveTimelineGaps([
      { id: 'A', timelineStartSeconds: 0, durationSeconds: 60 },
      { id: 'B', timelineStartSeconds: 600, durationSeconds: 120 },
    ]);

    expect(result.overlap).toBeUndefined();
    expect(result.clips[1].gapBeforeSeconds).toBe(540);
  });

  it('calculates the target absolute start from the two playheads', () => {
    expect(
      calculateTimelineStart({
        referenceStartSeconds: 0,
        referenceCurrentSeconds: 600,
        targetCurrentSeconds: 0,
      }),
    ).toBe(600);
  });

  it('supports an initial gap and three clips', () => {
    const result = deriveTimelineGaps([
      { id: 'A', timelineStartSeconds: 10, durationSeconds: 20 },
      { id: 'B', timelineStartSeconds: 35, durationSeconds: 10 },
      { id: 'C', timelineStartSeconds: 50, durationSeconds: 5 },
    ]);

    expect(result.clips.map((clip) => clip.gapBeforeSeconds)).toEqual([
      10, 5, 5,
    ]);
  });

  it('reports an overlap without changing the requested placement', () => {
    const result = deriveTimelineGaps([
      { id: 'A', timelineStartSeconds: 0, durationSeconds: 60 },
      { id: 'B', timelineStartSeconds: 30, durationSeconds: 20 },
    ]);

    expect(result.overlap).toEqual({
      previousClipId: 'A',
      clipId: 'B',
      overlapSeconds: 30,
    });
  });

  it('resolves a clip-local time and returns black during a known gap', () => {
    const clips = [
      { id: 'A', timelineStartSeconds: 0, durationSeconds: 60 },
      { id: 'B', timelineStartSeconds: 600, durationSeconds: 120 },
    ];

    expect(resolveTimelineClip(clips, 30)).toEqual({
      clip: clips[0],
      clipTimeSeconds: 30,
    });
    expect(resolveTimelineClip(clips, 300)).toBeNull();
    expect(resolveTimelineClip(clips, 610)).toEqual({
      clip: clips[1],
      clipTimeSeconds: 10,
    });
  });
});
