import { describe, expect, it } from 'vitest';
import { resolveRecordingRange } from './recordingRange';

describe('resolveRecordingRange', () => {
  it('applies time before and after the action', () => {
    const result = resolveRecordingRange({
      startTime: 10,
      endTime: 18,
      leadTimeSeconds: 5,
      lagTimeSeconds: 3,
    });

    expect(result).toEqual({ startTime: 5, endTime: 21 });
  });

  it('keeps legacy behaviour when padding is omitted', () => {
    expect(resolveRecordingRange({ startTime: 10, endTime: 18 })).toEqual({
      startTime: 10,
      endTime: 18,
    });
  });

  it('normalizes reversed start and end times', () => {
    expect(
      resolveRecordingRange({
        startTime: 18,
        endTime: 10,
        leadTimeSeconds: 2,
        lagTimeSeconds: 4,
      }),
    ).toEqual({ startTime: 8, endTime: 22 });
  });

  it('clamps the start time to zero', () => {
    expect(
      resolveRecordingRange({
        startTime: 2,
        endTime: 7,
        leadTimeSeconds: 5,
      }),
    ).toEqual({ startTime: 0, endTime: 7 });
  });

  it('can clamp the end time to a known duration', () => {
    expect(
      resolveRecordingRange({
        startTime: 95,
        endTime: 99,
        lagTimeSeconds: 10,
        maxTime: 100,
      }),
    ).toEqual({ startTime: 95, endTime: 100 });
  });
});
