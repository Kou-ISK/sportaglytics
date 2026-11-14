import { describe, expect, it } from 'vitest';
import { nativeMinimumFreeBytes } from './nativeCapacityPolicy';
describe('native export free-space policy', () => {
  it('separates the operational floor, stop allowance and activity buffer', () => {
    expect(nativeMinimumFreeBytes(10 * 1024 ** 3)).toBe(7 * 1024 ** 3);
    expect(nativeMinimumFreeBytes(24_243_120_350)).toBe(6 * 1024 ** 3 + 2_424_312_035);
  });
  it('rounds upward and accepts the supported maximum', () => {
    expect(nativeMinimumFreeBytes(11)).toBe(6 * 1024 ** 3 + 2);
    expect(nativeMinimumFreeBytes(32 * 1024 ** 3)).toBe(6 * 1024 ** 3 + Math.ceil(32 * 1024 ** 3 / 10));
  });
  it.each([0, -1, NaN, Infinity, 1.5, 32 * 1024 ** 3 + 1])('rejects an invalid or unsupported budget %s', (n) => {
    expect(() => nativeMinimumFreeBytes(n)).toThrow();
  });
});
