/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useMediaTimeSync } from './useMediaTimeSync';

it.each([9.9, 9.995])(
  'does not restore stale React target before reverse demand commits (target %s)',
  (target) => {
    let time = 10;
    let seeking = false;
    const listeners = new Map<string, () => void>();
    const writes: number[] = [];
    const ref = {
      current: {
        currentTime(value?: number): number {
          if (value !== undefined) {
            time = value;
            seeking = true;
            writes.push(value);
          }
          return time;
        },
        seeking: () => seeking,
        on: (name: string, cb: () => void) => listeners.set(name, cb),
        off: (name: string) => listeners.delete(name),
      },
    };
    const hook = renderHook(
      ({ clock }) => useMediaTimeSync(ref, true, clock, false),
      { initialProps: { clock: 10 } },
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent('video-seek-start', {
          detail: { time: target, reverse: true },
        }),
      );
      ref.current.currentTime(target); // seekEachPlayer, before React applies setReverseDemand.
      listeners.get('canplay')?.();
    });
    expect(writes).toEqual([target]);
    hook.unmount();
  },
);

it('does not restore the old target if seek-end arrives before the React commit', () => {
  let time = 10;
  const listeners = new Map<string, () => void>();
  const writes: number[] = [];
  const ref = {
    current: {
      currentTime(value?: number): number {
        if (value !== undefined) {
          time = value;
          writes.push(value);
        }
        return time;
      },
      seeking: () => false,
      on: (name: string, cb: () => void) => listeners.set(name, cb),
      off: (name: string) => listeners.delete(name),
    },
  };
  const hook = renderHook(
    ({ clock }) => useMediaTimeSync(ref, true, clock, false),
    { initialProps: { clock: 10 } },
  );
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', {
        detail: { time: 9.9, reverse: true },
      }),
    );
    ref.current.currentTime(9.9);
    window.dispatchEvent(new Event('video-seek-end'));
    listeners.get('canplay')?.();
  });
  expect(writes).toEqual([9.9]);
  hook.rerender({ clock: 9.9 });
  hook.unmount();
});
it('resumes source-load synchronization at the same target after an aborted reverse', () => {
  let time = 10;
  let source = 'file:///old.mp4';
  const listeners = new Map<string, () => void>();
  const writes: number[] = [];
  const ref = {
    current: {
      currentTime(value?: number): number {
        if (value !== undefined) {
          time = value;
          writes.push(value);
        }
        return time;
      },
      seeking: () => false,
      currentSrc: () => source,
      on: (name: string, cb: () => void) => listeners.set(name, cb),
      off: (name: string) => listeners.delete(name),
    },
  };
  const hook = renderHook(() => useMediaTimeSync(ref, true, 10, false));
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', {
        detail: { time: 9.9, reverse: true },
      }),
    );
    source = 'file:///new.mp4';
    time = 0;
    listeners.get('loadeddata')?.();
  });
  expect(writes).toEqual([10]);
  hook.unmount();
});

it('does not restore an old target when same-source loadeddata precedes the reverse commit', () => {
  let time = 10;
  const listeners = new Map<string, () => void>();
  const writes: number[] = [];
  const ref = {
    current: {
      currentTime(value?: number): number {
        if (value !== undefined) {
          time = value;
          writes.push(value);
        }
        return time;
      },
      currentSrc: () => 'file:///same.mp4',
      seeking: () => false,
      on: (name: string, cb: () => void) => listeners.set(name, cb),
      off: (name: string) => listeners.delete(name),
    },
  };
  const hook = renderHook(
    ({ clock }) => useMediaTimeSync(ref, true, clock, false),
    { initialProps: { clock: 10 } },
  );
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', {
        detail: { time: 9.9, reverse: true },
      }),
    );
    ref.current.currentTime(9.9);
    listeners.get('loadeddata')?.();
  });
  expect(writes).toEqual([9.9]);
  hook.rerender({ clock: 9.9 });
  hook.unmount();
});

it('recovers after reloading the same source and target', () => {
  let time = 10;
  const listeners = new Map<string, () => void>();
  const writes: number[] = [];
  const ref = {
    current: {
      currentTime(value?: number): number {
        if (value !== undefined) {
          time = value;
          writes.push(value);
        }
        return time;
      },
      currentSrc: () => 'file:///same.mp4',
      seeking: () => false,
      on: (name: string, cb: () => void) => listeners.set(name, cb),
      off: (name: string) => listeners.delete(name),
    },
  };
  const hook = renderHook(() => useMediaTimeSync(ref, true, 10, false));
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', {
        detail: { time: 9.9, reverse: true },
      }),
    );
    listeners.get('loadstart')?.();
    time = 0;
    listeners.get('loadeddata')?.();
  });
  expect(writes).toEqual([10]);
  hook.unmount();
});
