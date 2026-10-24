import { expect, it } from 'vitest';
import { planPlaybackRange, validateRangeIndex } from './rangeBufferIndex';
import type { PlaybackRangeIndex } from './rangeBufferIndex';
const index: PlaybackRangeIndex = {
  sourceGeneration: 'g',
  initializationBytes: 10,
  presentationEnd: 4.1,
  fragments: [
    {
      id: 0,
      bytes: 100,
      videoStart: 0.055,
      videoEnd: 2.055,
      sampleStart: 0.043,
      sampleEnd: 2.07,
      dependencies: [0],
    },
    {
      id: 1,
      bytes: 100,
      videoStart: 2.055,
      videoEnd: 4.055,
      sampleStart: 2.07,
      sampleEnd: 4.1,
      dependencies: [0, 1],
    },
  ],
};
it('retains the original empty prefix, whole-audio predecessor and final tail', () => {
  const fixed = {
    ...index,
    fragments: [
      index.fragments[0],
      { ...index.fragments[1], sampleStart: 2.05 },
    ],
  };
  const v = validateRangeIndex(fixed);
  expect(planPlaybackRange(v, 0, 0).target.id).toBe(0);
  expect(planPlaybackRange(v, 2.055, 0).required.map((x) => x.id)).toEqual([
    0, 1,
  ]);
  expect(planPlaybackRange(v, 4.09, 0).target.id).toBe(1);
  expect(() => planPlaybackRange(v, 4.1, 0)).toThrow();
});
it('rejects wrong video coverage, byte counts or future dependencies', () => {
  expect(() => validateRangeIndex(index)).toThrow('COVERAGE');
  for (const bad of [
    { sampleStart: 0, videoStart: 2.06 },
    { sampleStart: 0, bytes: NaN },
    { sampleStart: 0, dependencies: [1, 2] },
    { sampleStart: 0, sampleEnd: NaN },
  ])
    expect(() =>
      validateRangeIndex({
        ...index,
        fragments: [index.fragments[0], { ...index.fragments[1], ...bad }],
      }),
    ).toThrow();
});
it('snapshots mutable adapter data to prevent late index rewrites', () => {
  const source = {
    ...index,
    presentationEnd: 2.07,
    fragments: [{ ...index.fragments[0], dependencies: [0] }],
  };
  const immutable = validateRangeIndex(source);
  source.fragments[0].dependencies.push(1);
  source.fragments[0].bytes = 999;
  expect(immutable.fragments[0].dependencies).toEqual([0]);
  expect(immutable.fragments[0].bytes).toBe(100);
});

it('rejects an unproved extended tail instead of clamping to a stale final field', () => {
  expect(() =>
    validateRangeIndex({
      ...index,
      presentationEnd: 100,
      fragments: [{ ...index.fragments[0] }],
    }),
  ).toThrow('TAIL');
});
