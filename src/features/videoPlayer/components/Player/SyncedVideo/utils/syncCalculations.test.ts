import { describe, expect, it } from 'vitest';
import {
  calculateAdjustedCurrentTimes,
  calculateBlockStates,
} from './syncCalculations';

describe('multi-angle sync calculations', () => {
  it('applies an independent offset to every angle', () => {
    expect(
      calculateAdjustedCurrentTimes(['one', 'two', 'three'], 10, [0, -2, 3]),
    ).toEqual([10, 8, 13]);
  });

  it('blocks only angles whose delayed start has not been reached', () => {
    expect(
      calculateBlockStates({
        videoList: ['one', 'two', 'three'],
        analyzed: true,
        offsets: [0, -4, -1],
        primaryClock: 2,
      }),
    ).toEqual([false, true, false]);
  });
});
