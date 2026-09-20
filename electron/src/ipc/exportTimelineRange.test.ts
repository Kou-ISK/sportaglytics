import { describe, expect, it } from 'vitest';
import {
  buildExportTimelineSegments,
  findDirectExportSource,
} from './exportTimelineRange';
const clips = [
  {
    id: 'a',
    sourcePath: 'a.mp4',
    timelineStartSeconds: 0,
    durationSeconds: 3600,
  },
  {
    id: 'b',
    sourcePath: 'b.mp4',
    timelineStartSeconds: 3610,
    durationSeconds: 3600,
  },
];
describe('export timeline range', () => {
  it('only prepares requested intersections across boundaries and gaps', () => {
    expect(
      buildExportTimelineSegments(clips, 0, { start: 3598, end: 3612 }),
    ).toEqual([
      { sourcePath: 'a.mp4', sourceStart: 3598, duration: 2 },
      { sourceStart: 0, duration: 10 },
      { sourcePath: 'b.mp4', sourceStart: 0, duration: 2 },
    ]);
  });
  it('resolves both signed offsets without materializing a complete match', () => {
    for (const offset of [-2, 2]) {
      const range = { start: 3620, end: 3625 };
      const direct = findDirectExportSource(clips, offset, range);
      expect(direct).toEqual({
        sourcePath: 'b.mp4',
        timeOrigin: 3610 - offset,
      });
      expect(buildExportTimelineSegments(clips, offset, range)).toEqual([
        { sourcePath: 'b.mp4', sourceStart: 10 + offset, duration: 5 },
      ]);
    }
  });
  it('preserves completely empty intervals and leading/trailing black', () => {
    expect(
      buildExportTimelineSegments(clips, -2, { start: 0, end: 3 }),
    ).toEqual([
      { sourceStart: 0, duration: 2 },
      { sourcePath: 'a.mp4', sourceStart: 0, duration: 1 },
    ]);
    expect(
      buildExportTimelineSegments(clips, 0, { start: 3602, end: 3604 }),
    ).toEqual([{ sourceStart: 0, duration: 2 }]);
    expect(
      findDirectExportSource(clips, 0, { start: 3602, end: 3604 }),
    ).toBeNull();
  });
});
