// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/playlist/core';
import { useSlideClock } from './useSlideClock';

const slide = (id: string): PlaylistItem => ({
  id, timelineItemId: null, actionName: id, startTime: 0, endTime: 2, addedAt: 0,
  slide: { title: id, body: '' },
});

afterEach(() => { vi.useRealTimers(); });

it('pauses, seeks, resumes, and discards the previous slide timer on manual advance', () => {
  vi.useFakeTimers();
  const report = vi.fn();
  const end = vi.fn();
  const first = slide('first');
  const second = slide('second');
  const { result, rerender, unmount } = renderHook(
    ({ item, playing }) => useSlideClock(item, playing, report, end),
    { initialProps: { item: first, playing: true } },
  );
  act(() => vi.advanceTimersByTime(600));
  expect(report.mock.lastCall?.[0]).toBeCloseTo(.6, 1);
  rerender({ item: first, playing: false });
  act(() => result.current(1.5));
  act(() => vi.advanceTimersByTime(1000));
  expect(report).toHaveBeenLastCalledWith(1.5);
  rerender({ item: first, playing: true });
  act(() => vi.advanceTimersByTime(100));
  rerender({ item: second, playing: true });
  expect(report).toHaveBeenLastCalledWith(0);
  act(() => vi.advanceTimersByTime(650));
  expect(end).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1450));
  expect(report).toHaveBeenLastCalledWith(2);
  expect(end).toHaveBeenCalledTimes(1);
  unmount();
  act(() => vi.advanceTimersByTime(3000));
  expect(end).toHaveBeenCalledTimes(1);
});
