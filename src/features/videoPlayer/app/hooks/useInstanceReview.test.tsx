// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useInstanceReview } from './useInstanceReview';

const clip = (id: string, startTime: number, endTime: number) => ({
  id,
  startTime,
  endTime,
  actionName: 'Scrum',
  memo: '',
});

it('plays clips in supplied order, not match chronology, then stops', () => {
  const seek = vi.fn();
  const setPlaying = vi.fn();
  const { result, rerender } = renderHook(
    ({ clock }) =>
      useInstanceReview({
        clock,
        playing: true,
        seek,
        setPlaying,
        revision: 0,
      }),
    { initialProps: { clock: 40 } },
  );
  act(() =>
    result.current.start([clip('first', 20, 23), clip('second', 2, 5)]),
  );
  expect(seek.mock.calls.map((call) => call[1])).toEqual([20]);
  rerender({ clock: 41 });
  expect(seek).toHaveBeenCalledTimes(1);
  rerender({ clock: 20 });
  rerender({ clock: 23 });
  expect(seek.mock.calls.map((call) => call[1])).toEqual([20, 2]);
  rerender({ clock: 2 });
  rerender({ clock: 5 });
  expect(result.current.active).toBeNull();
  expect(setPlaying).toHaveBeenLastCalledWith(false);
});

it('preserves pause, closes explicitly, and cancels a stale document', () => {
  const seek = vi.fn();
  const setPlaying = vi.fn();
  const { result, rerender } = renderHook(
    (props) => useInstanceReview({ ...props, seek, setPlaying }),
    { initialProps: { clock: 0, playing: true, revision: 0 } },
  );
  act(() => result.current.start([clip('a', 1, 3), clip('b', 5, 8)]));
  rerender({ clock: 1, playing: true, revision: 0 });
  rerender({ clock: 3, playing: false, revision: 0 });
  expect(seek).toHaveBeenCalledTimes(1);
  act(() => result.current.stop());
  expect(result.current.active).toBeNull();
  expect(setPlaying).toHaveBeenLastCalledWith(false);
  act(() => result.current.start([clip('a', 1, 3)]));
  rerender({ clock: 0, playing: false, revision: 1 });
  expect(result.current.active).toBeNull();
});


it('consumes a queued clip at the package end when the clock stops on the same render', () => {
  const seek = vi.fn();
  const setPlaying = vi.fn();
  const { result, rerender } = renderHook(
    (props) => useInstanceReview({ ...props, seek, setPlaying, revision: 0, mediaEnd: 14 }),
    { initialProps: { clock: 0, playing: false } },
  );
  act(() => result.current.start([clip('final', 12, 14), clip('again', 1, 2)]));
  rerender({ clock: 12, playing: true });
  rerender({ clock: 13, playing: false });
  expect(result.current.active?.index).toBe(0);
  rerender({ clock: 14, playing: false });
  expect(seek.mock.calls.map((call) => call[1])).toEqual([12, 1]);
  rerender({ clock: 1, playing: true });
  rerender({ clock: 2, playing: true });
  expect(result.current.active).toBeNull();

  act(() => result.current.start([clip('long', 12, 15)]));
  rerender({ clock: 13, playing: true });
  rerender({ clock: 14, playing: false });
  expect(result.current.active).toBeNull();
  expect(setPlaying).toHaveBeenLastCalledWith(false);
});

it('rejects review requests during manual synchronization', () => {
  const seek = vi.fn();
  const setPlaying = vi.fn();
  const { result, rerender } = renderHook(
    ({ enabled }) => useInstanceReview({ enabled, clock: 0, playing: false, seek, setPlaying, revision: 0 }),
    { initialProps: { enabled: false } },
  );
  act(() => result.current.start([clip('matrix', 1, 3)]));
  expect(seek).not.toHaveBeenCalled();
  expect(setPlaying).not.toHaveBeenCalled();
  rerender({ enabled: true });
  act(() => result.current.start([clip('matrix', 1, 3)]));
  expect(seek).toHaveBeenCalledTimes(1);
});
