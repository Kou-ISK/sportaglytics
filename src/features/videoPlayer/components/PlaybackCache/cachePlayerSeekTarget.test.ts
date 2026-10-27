import { expect, it } from 'vitest';
import { resolveCachePlayerSeekTarget } from './cachePlayerSeekTarget';

it('bounds only a sub-microsecond endpoint difference', () => {
  expect(resolveCachePlayerSeekTarget(120.12345633333333, 120.123456)).toBe(
    120.123456,
  );
  expect(resolveCachePlayerSeekTarget(119.987654321, 120.123456)).toBe(
    119.987654321,
  );
  expect(resolveCachePlayerSeekTarget(120.123458, 120.123456)).toBeNull();
});

it.each([-0.0000005, 0, NaN, Infinity])(
  'rejects an invalid duration %s',
  (duration) => {
    expect(resolveCachePlayerSeekTarget(0, duration)).toBeNull();
  },
);

it.each([-1, NaN, Infinity])('rejects an invalid time %s', (time) => {
  expect(resolveCachePlayerSeekTarget(time, 120)).toBeNull();
});

it('maps only a qualified source endpoint within existing stopped-image precision', () => {
  const sourceEnd = 120.12333333333333;
  const htmlEnd = 120.123133;
  expect(resolveCachePlayerSeekTarget(sourceEnd, htmlEnd, sourceEnd)).toBe(
    htmlEnd,
  );
  expect(resolveCachePlayerSeekTarget(sourceEnd, htmlEnd)).toBeNull();
  expect(
    resolveCachePlayerSeekTarget(sourceEnd - 0.0001, htmlEnd, sourceEnd),
  ).toBeNull();
  expect(
    resolveCachePlayerSeekTarget(sourceEnd + 0.0001, htmlEnd, sourceEnd),
  ).toBeNull();
  expect(
    resolveCachePlayerSeekTarget(sourceEnd, htmlEnd - 0.003, sourceEnd),
  ).toBeNull();
  expect(resolveCachePlayerSeekTarget(sourceEnd, NaN, sourceEnd)).toBeNull();
});
