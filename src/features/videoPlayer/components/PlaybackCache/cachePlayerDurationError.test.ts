import { expect, it } from 'vitest';
import { CachePlayerDurationError } from './cachePlayerDurationError';
it.each([
  [NaN, 1],
  [Infinity, 2],
  [-Infinity, 3],
  [86401, 4],
  [-86401, 4],
])(
  'encodes invalid duration %s with numeric kind %s',
  (duration, durationKind) => {
    expect(
      new CachePlayerDurationError(
        'NATIVE_ORIGINAL_DURATION',
        20,
        duration,
        4,
        false,
      ).recovery,
    ).toEqual({
      requestedTime: 20,
      duration: 0,
      durationKind,
      readyState: 4,
      seeking: 0,
    });
  },
);
it('keeps finite invalid endpoints distinct and omits an invalid requested time', () => {
  expect(
    new CachePlayerDurationError('CACHE_SWITCH_DURATION', 0, -1, 9, true)
      .recovery,
  ).toEqual({
    requestedTime: 0,
    duration: -1,
    durationKind: 0,
    readyState: 5,
    seeking: 1,
  });
  expect(
    new CachePlayerDurationError('CACHE_SWITCH_DURATION', NaN, 10, 2, false)
      .recovery,
  ).toBeUndefined();
});
