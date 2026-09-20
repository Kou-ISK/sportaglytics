import { describe, expect, it } from 'vitest';
import { alignAngleSyncPoints, resolveAngleSyncTime } from './angleSync';
import type { AngleSyncDraft } from './angleSync';
const makeDraft = (): AngleSyncDraft => ({
  offsets: [0, 0],
  angles: [0, 1].map((angle) => ({
    id: `angle${angle}`,
    name: `Angle ${angle + 1}`,
    sourceKind: 'local',
    clips: [0, 1].map((clip) => ({
      id: `${angle}-${clip}`,
      source: `videos/${angle}-${clip}.mp4`,
      sourceKind: 'local',
      timelineStartSeconds: clip * 6,
      gapBeforeSeconds: 0,
      durationSeconds: 6,
    })),
  })),
});
describe('angle sync points', () => {
  it('aligns first-half angles and moves their later segments together', () => {
    const draft = makeDraft();
    const next = alignAngleSyncPoints(draft, {
      angle0: { clipId: '0-0', sourceTime: 2 },
      angle1: { clipId: '1-0', sourceTime: 1 },
    });
    expect(
      next.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    ).toEqual([1, 7]);
    expect(draft.angles[1].clips[0].timelineStartSeconds).toBe(0);
    expect(resolveAngleSyncTime(next.angles[1], 0, 8)?.clip.id).toBe('1-1');
    const second = alignAngleSyncPoints(next, {
      angle0: { clipId: '0-1', sourceTime: 3 },
      angle1: { clipId: '1-1', sourceTime: 1 },
    });
    expect(
      second.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    ).toEqual([1, 8]);
  });
  it('aligns the second clip of angle 2 to the first clip of angle 1, leaving the uncovered interval black', () => {
    const draft = makeDraft();
    draft.angles[0].clips = [
      { ...draft.angles[0].clips[0], durationSeconds: 30 },
    ];
    draft.angles[1].clips[0].durationSeconds = 10;
    draft.angles[1].clips[1] = {
      ...draft.angles[1].clips[1],
      timelineStartSeconds: 10,
      durationSeconds: 5,
    };
    const next = alignAngleSyncPoints(draft, {
      angle0: { clipId: '0-0', sourceTime: 26 },
      angle1: { clipId: '1-1', sourceTime: 1 },
    });
    expect(
      next.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    ).toEqual([0, 25]);
    for (const time of [10, 15, 24.999])
      expect(resolveAngleSyncTime(next.angles[1], 0, time)).toBeNull();
    expect(resolveAngleSyncTime(next.angles[1], 0, 9.999)?.clip.id).toBe('1-0');
    expect(resolveAngleSyncTime(next.angles[1], 0, 25)?.sourceTime).toBe(0);
    expect(resolveAngleSyncTime(next.angles[1], 0, 29.999)?.clip.id).toBe(
      '1-1',
    );
  });
  it('allows trimming the beginning without negative persisted placements', () => {
    const next = alignAngleSyncPoints(makeDraft(), {
      angle0: { clipId: '0-0', sourceTime: 1 },
      angle1: { clipId: '1-0', sourceTime: 2 },
    });
    expect(next.offsets).toEqual([0, 1]);
    expect(
      next.angles[1].clips.map((clip) => clip.timelineStartSeconds),
    ).toEqual([0, 6]);
    expect(
      resolveAngleSyncTime(next.angles[1], next.offsets[1], 1)?.sourceTime,
    ).toBe(2);
  });
  it('rejects overlaps and incomplete or out-of-range points without changing the draft', () => {
    const draft = makeDraft();
    expect(() =>
      alignAngleSyncPoints(draft, { angle0: { clipId: '0-0', sourceTime: 0 } }),
    ).toThrow('同期点');
    expect(() =>
      alignAngleSyncPoints(draft, {
        angle0: { clipId: '0-1', sourceTime: 0 },
        angle1: { clipId: '1-1', sourceTime: 2 },
      }),
    ).toThrow('重なり');
    expect(() =>
      alignAngleSyncPoints(draft, {
        angle0: { clipId: '0-0', sourceTime: NaN },
        angle1: { clipId: '1-0', sourceTime: 2 },
      }),
    ).toThrow();
    expect(draft.angles[1].clips[1].timelineStartSeconds).toBe(6);
  });
  it('aligns three and four angles using the first angle as the common reference', () => {
    const draft = makeDraft();
    draft.angles.push(
      ...draft.angles.map((angle, i) => ({ ...angle, id: `extra${i}` })),
    );
    draft.offsets = [0, 0, 0, 0];
    const points = Object.fromEntries(
      draft.angles.map((angle, i) => [
        angle.id,
        { clipId: angle.clips[0].id, sourceTime: 4 - i },
      ]),
    );
    const next = alignAngleSyncPoints(draft, points);
    expect(
      next.angles.map((angle) => angle.clips[0].timelineStartSeconds),
    ).toEqual([0, 1, 2, 3]);
  });
});
