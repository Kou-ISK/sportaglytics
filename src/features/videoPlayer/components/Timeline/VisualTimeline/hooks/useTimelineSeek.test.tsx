// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import { useTimelineSeek } from './useTimelineSeek';

it('keeps one gesture callback through rerender, movement, release and cancellation', () => {
  const target = document.createElement('div');
  target.setPointerCapture = vi.fn();
  target.hasPointerCapture = () => true;
  target.releasePointerCapture = vi.fn();
  // Only the properties consumed by this hook are required in the fixture.
  const event = {
    pointerId: 1,
    button: 0,
    clientX: 20,
    currentTarget: target,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as PointerEvent<HTMLElement>;
  for (const end of ['onPointerUp', 'onPointerCancel', 'unmount'] as const) {
    const first = vi.fn(),
      second = vi.fn();
    const hook = renderHook(
      (seek) =>
        useTimelineSeek(
          (x) => x,
          (x) => x,
          seek,
        ),
      { initialProps: first },
    );
    act(() => hook.result.current.onPointerDown(event));
    hook.rerender(second);
    act(() => hook.result.current.onPointerMove({ ...event, clientX: 30 }));
    if (end === 'unmount') hook.unmount();
    else {
      act(() => hook.result.current[end](event));
      hook.unmount();
    }
    expect(second).not.toHaveBeenCalled();
    expect(first.mock.calls.map((call) => call[1])).toEqual([
      'preview',
      'preview',
      'scrub',
    ]);
  }
});

it('follows the owned pointer outside the bar when capture is unavailable, and commits once', () => {
  const target = document.createElement('div');
  target.setPointerCapture = () => { throw new DOMException('Inactive pointer', 'NotFoundError'); };
  target.hasPointerCapture = () => false;
  target.releasePointerCapture = vi.fn();
  const commit = vi.fn();
  const hook = renderHook(() =>
    useTimelineSeek(
      (x) => x,
      (x) => x / 10,
      commit,
    ),
  );
  const down = {
    pointerId: 7,
    button: 0,
    clientX: 10,
    currentTarget: target,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as PointerEvent<HTMLElement>; // React pointer fixture.
  act(() => hook.result.current.onPointerDown(down));
  const send = (name: string, id: number, x: number): void => {
    const event = new MouseEvent(name, { clientX: x });
    Object.defineProperty(event, 'pointerId', { value: id });
    window.dispatchEvent(event);
  };
  act(() => {
    send('pointermove', 9, 100);
    send('pointermove', 7, 40);
    send('pointerup', 7, 20);
    send('pointerup', 7, 80);
  });
  expect(commit.mock.calls).toEqual([
    [1, 'preview'],
    [4, 'preview'],
    [2, 'scrub'],
  ]);
  hook.unmount();
});
