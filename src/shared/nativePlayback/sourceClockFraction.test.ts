import { describe, expect, it } from 'vitest';
import { sourceClockFraction } from './sourceClockFraction';

describe('bounded original source clocks', () => {
  it.each([0, 1.123, 1.123001, 9017.992316, 86400])(
    'preserves the existing nanosecond representation of %s',
    (seconds) => {
      const clock = sourceClockFraction(seconds);
      expect(clock).toEqual({
        value: Math.round(seconds * 1_000_000_000),
        scale: 1_000_000_000,
      });
    },
  );

  it.each([2709.002386456509, 1.123000000123, 2.500001 + 10])(
    'preserves a non-nanosecond pointer or relative target %s',
    (seconds) => {
      expect(Math.round(seconds * 1_000_000_000) / 1_000_000_000).not.toBe(
        seconds,
      );
      const clock = sourceClockFraction(seconds);
      expect(clock).not.toBeNull();
      if (!clock) throw Error('expected a representable clock');
      expect(Number.isSafeInteger(clock.value)).toBe(true);
      expect(Number.isSafeInteger(clock.scale)).toBe(true);
      expect(clock.scale).toBeGreaterThan(0);
      expect(clock.scale).toBeLessThanOrEqual(1_000_000_000);
      expect(clock.value / clock.scale).toBe(seconds);
    },
  );

  it('does not merge distinct clocks within the same field', () => {
    const first = sourceClockFraction(1.123000000123);
    const second = sourceClockFraction(1.123000000124);
    expect(first).not.toEqual(second);
    expect(first && first.value / first.scale).toBe(1.123000000123);
    expect(second && second.value / second.scale).toBe(1.123000000124);
  });

  it.each([
    -1,
    86401,
    NaN,
    Infinity,
    -Infinity,
    Number.MIN_VALUE,
    1e-20,
    1e-10,
  ])('retains fallback for invalid or unrepresentable clock %s', (seconds) =>
    expect(sourceClockFraction(seconds)).toBeNull(),
  );
});
