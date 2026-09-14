// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import { useStudioGesture } from './useStudioGesture';

const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 450;
canvas.getBoundingClientRect = () => new DOMRect(10, 20, 800, 450);
canvas.setPointerCapture = vi.fn();
canvas.releasePointerCapture = vi.fn();
canvas.hasPointerCapture = () => true;
const pointer = (x: number, y: number): PointerEvent<HTMLCanvasElement> =>
  ({
    currentTarget: canvas,
    clientX: x + 10,
    clientY: y + 20,
    button: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as PointerEvent<HTMLCanvasElement>; // Minimal synthetic event for the hook's pointer boundary.

const drawingParams = {
  documentKey: 'first-gesture',
  enabled: true,
  canvasRef: { current: canvas },
  contentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
  objects: [],
  tool: 'arrow' as const,
  color: '#ffffff',
  strokeWidth: 4,
  opacity: 1,
  fill: false,
  dashed: false,
  time: 10,
  target: 'primary' as const,
  selectedId: null,
  onSelect: vi.fn(),
};

it('commits a fast drag even when the browser only delivers down and up', () => {
  const onCommit = vi.fn();
  const { result } = renderHook(() =>
    useStudioGesture({ ...drawingParams, onCommit }),
  );
  act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
  act(() => result.current.handlers.onPointerUp(pointer(240, 190)));
  expect(onCommit).toHaveBeenCalledOnce();
  expect(onCommit.mock.calls[0][0][0]).toMatchObject({ endX: 240, endY: 190 });
});

it('keeps a paused-frame gesture through a late playback clock update', () => {
  const onCommit = vi.fn();
  const { result, rerender } = renderHook(
    ({ time }) => useStudioGesture({ ...drawingParams, time, onCommit }),
    { initialProps: { time: 10 } },
  );
  act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
  act(() => result.current.handlers.onPointerMove(pointer(240, 190)));
  rerender({ time: 10.000001 });
  act(() => result.current.handlers.onPointerUp(pointer(250, 200)));
  expect(onCommit).toHaveBeenCalledOnce();
  expect(onCommit.mock.calls[0][0][0]).toMatchObject({
    timestamp: 10,
    endX: 250,
    endY: 200,
  });
});

it('cancels an explicit seek even within the same frame and ignores a second pointer', () => {
  const onCommit = vi.fn();
  const { result, rerender } = renderHook(
    ({ seekRevision }) =>
      useStudioGesture({ ...drawingParams, seekRevision, onCommit }),
    { initialProps: { seekRevision: 0 } },
  );
  act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
  act(() =>
    result.current.handlers.onPointerMove({
      ...pointer(240, 190),
      pointerId: 2,
    }),
  );
  act(() =>
    result.current.handlers.onPointerUp({ ...pointer(240, 190), pointerId: 2 }),
  );
  expect(onCommit).not.toHaveBeenCalled();
  act(() => result.current.handlers.onPointerMove(pointer(200, 180)));
  rerender({ seekRevision: 1 });
  act(() => result.current.handlers.onPointerUp(pointer(240, 190)));
  expect(onCommit).not.toHaveBeenCalled();
});

it('does not create an invisible shape from a click or save a gesture after a time jump', () => {
  const onCommit = vi.fn();
  const { result, rerender } = renderHook(
    ({ time }) => useStudioGesture({ ...drawingParams, time, onCommit }),
    { initialProps: { time: 10 } },
  );
  act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
  act(() => result.current.handlers.onPointerUp(pointer(100, 100)));
  expect(onCommit).not.toHaveBeenCalled();
  act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
  act(() => result.current.handlers.onPointerMove(pointer(200, 180)));
  rerender({ time: 11 });
  act(() => result.current.handlers.onPointerUp(pointer(240, 190)));
  expect(onCommit).not.toHaveBeenCalled();
});

describe('Studio gesture transactions', () => {
  it('commits one history entry per drag using content coordinates', () => {
    const commit = vi.fn();
    const { result } = renderHook(() =>
      useStudioGesture({
        documentKey: 'clip1',
        enabled: true,
        canvasRef: { current: canvas },
        contentRect: { width: 700, height: 400, offsetX: 50, offsetY: 25 },
        objects: [],
        tool: 'arrow',
        color: '#ffffff',
        strokeWidth: 4,
        opacity: 1,
        fill: false,
        dashed: false,
        time: 10,
        target: 'primary',
        selectedId: null,
        onSelect: vi.fn(),
        onCommit: commit,
      }),
    );
    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    act(() => result.current.handlers.onPointerMove(pointer(200, 200)));
    act(() => result.current.handlers.onPointerMove(pointer(250, 225)));
    expect(commit).not.toHaveBeenCalled();
    act(() => result.current.handlers.onPointerUp(pointer(250, 225)));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0][0]).toMatchObject({
      startX: 50,
      startY: 75,
      endX: 200,
      endY: 200,
      timestamp: 10,
      baseWidth: 700,
      baseHeight: 400,
    });
  });
  it('discards unfinished drawing after the clip changes or pointer cancels', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ key }) =>
        useStudioGesture({
          documentKey: key,
          enabled: true,
          canvasRef: { current: canvas },
          contentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
          objects: [],
          tool: 'rectangle',
          color: '#ffffff',
          strokeWidth: 4,
          opacity: 1,
          fill: false,
          dashed: false,
          time: 10,
          target: 'primary',
          selectedId: null,
          onSelect: vi.fn(),
          onCommit: commit,
        }),
      { initialProps: { key: 'one' } },
    );
    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    act(() => result.current.handlers.onPointerMove(pointer(250, 225)));
    rerender({ key: 'two' });
    act(() => result.current.handlers.onPointerUp(pointer(250, 225)));
    expect(commit).not.toHaveBeenCalled();
    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    act(() => result.current.handlers.onPointerMove(pointer(250, 225)));
    act(() => result.current.handlers.onPointerCancel());
    act(() => result.current.handlers.onPointerUp(pointer(250, 225)));
    expect(commit).not.toHaveBeenCalled();
  });
});

it('moves only the selected player node in stored coordinates and commits once', () => {
  const commit = vi.fn();
  const { result } = renderHook(() =>
    useStudioGesture({
      documentKey: 'linked',
      enabled: true,
      canvasRef: { current: canvas },
      contentRect: { width: 400, height: 225, offsetX: 50, offsetY: 20 },
      objects: [
        {
          id: 'link',
          type: 'linkedDiscs',
          startX: 100,
          startY: 100,
          endX: 300,
          endY: 200,
          path: [
            { x: 100, y: 100 },
            { x: 200, y: 120 },
            { x: 300, y: 200 },
          ],
          color: '#ffffff',
          strokeWidth: 4,
          timestamp: 10,
          baseWidth: 800,
          baseHeight: 450,
        },
      ],
      tool: 'select',
      color: '#ffffff',
      strokeWidth: 4,
      opacity: 1,
      fill: false,
      dashed: false,
      time: 10,
      target: 'primary',
      selectedId: 'link',
      onSelect: vi.fn(),
      onCommit: commit,
    }),
  );
  act(() => result.current.handlers.onPointerDown(pointer(150, 80)));
  act(() => result.current.handlers.onPointerMove(pointer(170, 100)));
  expect(commit).not.toHaveBeenCalled();
  act(() => result.current.handlers.onPointerUp(pointer(170, 100)));
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0][0][0].path).toEqual([
    { x: 100, y: 100 },
    { x: 240, y: 160 },
    { x: 300, y: 200 },
  ]);
});

it('places players with individual clicks and commits the whole link once', () => {
  const commit = vi.fn();
  const { result } = renderHook(() =>
    useStudioGesture({
      documentKey: 'six-players',
      enabled: true,
      canvasRef: { current: canvas },
      contentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
      objects: [],
      tool: 'linkedDiscs',
      color: '#ffffff',
      strokeWidth: 3,
      opacity: 1,
      fill: false,
      dashed: false,
      time: 10,
      target: 'primary',
      selectedId: null,
      onSelect: vi.fn(),
      onCommit: commit,
    }),
  );
  for (let index = 0; index < 6; index++) {
    act(() =>
      result.current.handlers.onPointerDown({
        ...pointer(100 + index * 35, 100 + index * 10),
        pointerId: index + 1,
      }),
    );
    act(() =>
      result.current.handlers.onPointerUp({
        ...pointer(100 + index * 35, 100 + index * 10),
        pointerId: index + 1,
      }),
    );
    act(() => result.current.handlers.onLostPointerCapture());
  }
  expect(commit).not.toHaveBeenCalled();
  expect(result.current.linkCount).toBe(6);
  act(() => result.current.finishLink());
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0][0][0].path).toEqual(
    Array.from({ length: 6 }, (_, index) => ({
      x: 100 + index * 35,
      y: 100 + index * 10,
    })),
  );
  expect(result.current.linkCount).toBe(0);
});
