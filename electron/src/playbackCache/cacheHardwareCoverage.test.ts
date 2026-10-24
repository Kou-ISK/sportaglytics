import { expect, it } from 'vitest';
import {
  isCacheHardwareCoverageValid,
  planCacheCompatibility,
  readCacheHardwareCoverage,
} from './cacheHardwareCoverage';
import type { CacheHardwareCoverage } from './cacheHardwareCoverage';
const complete = () => ({
  completed: true,
  ended: false,
  failed: false,
  frames: 180,
  maximumTime: 60.05,
  duration: 60.074667,
  segments: planCacheCompatibility(60.074667).map((r, i) => ({
    ...r,
    firstClock: r.start + 0.05,
    lastClock: r.end - 0.04,
    first: r.start + 0.06,
    last: r.end - 0.04,
    frames: 60,
    ended: i === 2,
  })),
});
it('bounds compatibility media time independently of duration and avoids overlapping short ranges', () => {
  expect(
    planCacheCompatibility(9000).reduce((n, r) => n + r.end - r.start, 0),
  ).toBe(6);
  expect(planCacheCompatibility(6)).toEqual([{ start: 0, end: 6 }]);
  expect(planCacheCompatibility(0.1)).toEqual([{ start: 0, end: 0.1 }]);
  expect(() => planCacheCompatibility(Infinity)).toThrow();
  expect(
    readCacheHardwareCoverage(complete(), 'compatibility', 60.115).coverage
      .mode,
  ).toBe('compatibility');
});
it.each([
  'missing',
  'jump',
  'no-progress',
  'wrong-start',
  'early-end',
  'no-end',
  'late-start',
  'short-span',
  'full-claim',
  'failure',
  'incomplete',
])('rejects %s compatibility evidence', (failure) => {
  const state = complete();
  switch (failure) {
    case 'missing':
      state.segments.pop();
      break;
    case 'jump':
      state.segments[1].first = state.segments[1].last;
      break;
    case 'no-progress':
      state.segments[1].frames = 1;
      break;
    case 'wrong-start':
      state.segments[1].start++;
      break;
    case 'early-end':
      state.segments[0].ended = true;
      break;
    case 'no-end':
      state.segments[2].ended = false;
      break;
    case 'late-start':
      state.segments[1].first += 1;
      break;
    case 'short-span':
      state.segments[1].last = state.segments[1].first + 0.01;
      break;
    case 'full-claim':
      state.ended = true;
      break;
    case 'failure':
      state.failed = true;
      break;
    case 'incomplete':
      state.completed = false;
      break;
  }
  expect(() =>
    readCacheHardwareCoverage(state, 'compatibility', 60.115),
  ).toThrow();
});
it('never treats full and compatibility as interchangeable gate evidence', () => {
  const compatibility = readCacheHardwareCoverage(
    complete(),
    'compatibility',
    60.115,
  ).coverage;
  expect(isCacheHardwareCoverageValid(compatibility, 'full')).toBe(false);
  const full: CacheHardwareCoverage = { mode: 'full', ended: true };
  expect(isCacheHardwareCoverageValid(full, 'compatibility')).toBe(false);
  expect(isCacheHardwareCoverageValid(full, 'full')).toBe(true);
});

it('separates native duration from proof-bound presentation timestamps', () => {
  const state = complete();
  state.segments[2].last = 60.098317;
  state.segments[2].lastClock = 60.05;
  expect(
    readCacheHardwareCoverage(state, 'compatibility', 60.115).coverage.mode,
  ).toBe('compatibility');
  expect(() =>
    readCacheHardwareCoverage(state, 'compatibility', 60.074667),
  ).toThrow();
  state.segments[2].last = 60.116;
  expect(() =>
    readCacheHardwareCoverage(state, 'compatibility', 60.115),
  ).toThrow();
});
it('rejects long callback overshoot and a clock that advances without enough decoded media progress', () => {
  const state = complete();
  state.segments[0].lastClock = 8;
  state.segments[0].last = 8;
  expect(() =>
    readCacheHardwareCoverage(state, 'compatibility', 60.115),
  ).toThrow();
  const frozen = complete();
  frozen.segments[0].last = frozen.segments[0].first + 0.001;
  expect(() =>
    readCacheHardwareCoverage(frozen, 'compatibility', 60.115),
  ).toThrow();
});

it('rejects replaying the same leading pictures in later ranges or shifting every presented interval', () => {
  const repeated = complete();
  repeated.segments.forEach((segment) => {
    segment.first = 0.06;
    segment.last = 1.95;
  });
  expect(() =>
    readCacheHardwareCoverage(repeated, 'compatibility', 60.115),
  ).toThrow();
  const shifted = complete();
  shifted.segments.forEach((segment) => {
    segment.first += 2;
    segment.last += 2;
  });
  expect(() =>
    readCacheHardwareCoverage(shifted, 'compatibility', 62.115),
  ).toThrow();
});
