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
