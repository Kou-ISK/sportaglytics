import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseSourceImageProgress } from '../testing/source-image-progress.mjs';

test('different clocks and pair IDs with unchanged source images are not image progress', () => {
  assert.deepEqual(
    reverseSourceImageProgress(
      [
        { ms: 30, ticks: 19.99, pair: 2, sourcePTS: [19.98, 21.98] },
        { ms: 70, ticks: 19.985, pair: 3, sourcePTS: [19.98, 21.98] },
      ],
      [19.98, 21.98],
      10,
      110,
    ),
    {
      changedImagePairs: 0,
      angleImageChanges: [0, 0],
      firstAngleImageChangeMs: [null, null],
      maximumAngleImageSilenceMs: [100, 100],
      trailingAngleImageSilenceMs: [100, 100],
      firstSourceImageChangeMs: null,
      maximumSourceImageSilenceMs: 100,
      trailingSourceImageSilenceMs: 100,
    },
  );
});
test('one-angle changes and repeated pairs preserve the actual first image and trailing stall', () => {
  assert.deepEqual(
    reverseSourceImageProgress(
      [
        { ms: 20, sourcePTS: [10, 12] },
        { ms: 40, sourcePTS: [9.9, 12] },
        { ms: 45, sourcePTS: [9.9, 12] },
        { ms: 60, sourcePTS: [9.9, 11.9] },
      ],
      [10, 12],
      0,
      250,
    ),
    {
      changedImagePairs: 2,
      angleImageChanges: [1, 1],
      firstAngleImageChangeMs: [40, 60],
      maximumAngleImageSilenceMs: [210, 190],
      trailingAngleImageSilenceMs: [210, 190],
      firstSourceImageChangeMs: 40,
      maximumSourceImageSilenceMs: 190,
      trailingSourceImageSilenceMs: 190,
    },
  );
});
test('no delivered source image records the whole hold as silence', () => {
  assert.deepEqual(reverseSourceImageProgress([], [1, 3], 10, 2510), {
    changedImagePairs: 0,
    angleImageChanges: [0, 0],
    firstAngleImageChangeMs: [null, null],
    maximumAngleImageSilenceMs: [2500, 2500],
    trailingAngleImageSilenceMs: [2500, 2500],
    firstSourceImageChangeMs: null,
    maximumSourceImageSilenceMs: 2500,
    trailingSourceImageSilenceMs: 2500,
  });
});
test('rejects invalid PTS, out-of-order times and a forward image during reverse', () => {
  for (const sourcePTS of [
    [1],
    [NaN, 1],
    [1, Infinity],
    ['1', 2],
    [-1, 2],
    [2, 2],
  ])
    assert.throws(() =>
      reverseSourceImageProgress([{ ms: 1, sourcePTS }], [1, 2], 0, 2),
    );
  assert.throws(() =>
    reverseSourceImageProgress([{ ms: 3, sourcePTS: [1, 2] }], [1, 2], 0, 2),
  );
  assert.throws(() =>
    reverseSourceImageProgress(
      [
        { ms: 2, sourcePTS: [1, 2] },
        { ms: 1, sourcePTS: [1, 2] },
      ],
      [1, 2],
      0,
      3,
    ),
  );
});
