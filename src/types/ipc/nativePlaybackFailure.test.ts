import { parseNativePlaybackAvailability } from './nativePlayback';
import { expect, it } from 'vitest';
import { parseNativePlaybackFailure } from './nativePlaybackFailure';

const failure = {
  stage: 2,
  code: 26,
  sequence: 6,
  seekId: 2,
  targetTime: 120.123333,
  confirmedTime: 4,
};
const recovery = {
  requestedTime: 120.123333,
  duration: 120.123133,
  durationKind: 0,
  readyState: 2,
  seeking: 0,
};

it('accepts bounded numeric context from the failing restore attempt', () => {
  expect(parseNativePlaybackFailure({ ...failure, recovery })).toEqual({
    ...failure,
    recovery,
  });
  expect(parseNativePlaybackFailure(failure)).toEqual(failure);
});

it.each([
  { ...recovery, duration: NaN },
  { ...recovery, durationKind: 9 },
  { ...recovery, durationKind: 1, duration: 12 },
  { ...recovery, requestedTime: Infinity },
  { ...recovery, readyState: 6 },
  { ...recovery, seeking: 2 },
  { ...recovery, secret: 'private' },
])('rejects invalid or excess recovery data', (value) => {
  expect(() =>
    parseNativePlaybackFailure({ ...failure, recovery: value }),
  ).toThrow();
});

it('validates the optional-known package endpoint independently of presentation', () => {
  const available = {
    available: true,
    owner: { generation: 'endpoint', sourceKey: 'a'.repeat(64) },
    sourceUrl: 'file:///synthetic.mp4',
    reason: null,
    presentation: null,
    sourceEnd: 20.0002,
  };
  expect(parseNativePlaybackAvailability(available).sourceEnd).toBe(20.0002);
  expect(
    parseNativePlaybackAvailability({ ...available, sourceEnd: null })
      .sourceEnd,
  ).toBeNull();
  for (const sourceEnd of [undefined, NaN, Infinity, 0, -1, 86401, '20'])
    expect(() =>
      parseNativePlaybackAvailability({ ...available, sourceEnd }),
    ).toThrow();
  expect(() =>
    parseNativePlaybackAvailability({
      ...available,
      available: false,
      owner: null,
      sourceUrl: null,
      reason: 'disabled',
    }),
  ).toThrow();
});
