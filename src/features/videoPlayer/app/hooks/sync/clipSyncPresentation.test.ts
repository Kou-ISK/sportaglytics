import { describe, expect, it } from 'vitest';
import { formatSyncTime, getClipSyncOverlap } from './clipSyncPresentation';
describe('linked clip preview bounds', () => {
  it('limits playback to the shared portion for either correction direction', () => {
    expect(getClipSyncOverlap(6, 6, -2)).toEqual({ start: 2, end: 6 });
    expect(getClipSyncOverlap(6, 6, 2)).toEqual({ start: 0, end: 4 });
    expect(getClipSyncOverlap(6, 6, -7)).toBeNull();
  });
  it('shows milliseconds and carries rounding into the next minute', () => {
    expect(formatSyncTime(59.9999)).toBe('01:00.000');
    expect(formatSyncTime(-2.125)).toBe('−00:02.125');
  });
});
