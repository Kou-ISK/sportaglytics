import { describe, expect, it } from 'vitest';
import { formatSyncTime } from './clipSyncPresentation';
describe('linked clip preview bounds', () => {
  it('shows milliseconds and carries rounding into the next minute', () => {
    expect(formatSyncTime(59.9999)).toBe('01:00.000');
    expect(formatSyncTime(-2.125)).toBe('−00:02.125');
  });
});
