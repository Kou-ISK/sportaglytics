/* @vitest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useCodingTime } from './useCodingTime';

it('an existing coding command reads the latest common clock across source changes and seeks', () => {
  const { result, rerender } = renderHook(({ time }) => useCodingTime(time), {
    initialProps: { time: 3599.5 },
  });
  const readTime = result.current;
  expect(readTime()).toBe(3599.5);
  rerender({ time: 3602 }); // The second source is only two seconds in.
  expect(result.current).toBe(readTime);
  expect(readTime()).toBe(3602);
  rerender({ time: 3610 }); // No primary-angle footage; the package clock continues.
  expect(readTime()).toBe(3610);
  rerender({ time: 0 });
  expect(readTime()).toBe(0);
});

it.each([null, Number.NaN, Number.POSITIVE_INFINITY])(
  'does not record without a valid package clock (%s)',
  (time) => {
    const initialProps: { value: number | null } = { value: 12 };
    const { result, rerender } = renderHook(
      ({ value }: { value: number | null }) => useCodingTime(value),
      { initialProps },
    );
    const readTime = result.current;
    expect(readTime()).toBe(12);
    rerender({ value: time });
    expect(readTime()).toBeNull();
  },
);
