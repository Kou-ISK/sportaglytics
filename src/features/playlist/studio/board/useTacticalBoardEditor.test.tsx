// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useTacticalBoardEditor } from './useTacticalBoardEditor';
it('treats a drag as one undo operation, preserves manual markers on import, and cancels unfinished moves', () => {
  const { result } = renderHook(() =>
    useTacticalBoardEditor({
      widthMeters: 70,
      lengthMeters: 100,
      time: 5,
      markers: [{ id: 'a', kind: 'team1', label: '9', x: 10, y: 20 }],
      arrows: [],
    }),
  );
  act(() => result.current.onMove('a', { x: 11, y: 21 }, false));
  act(() => result.current.onMove('a', { x: 12, y: 22 }, false));
  expect(result.current.canUndo).toBe(false);
  act(() => result.current.onMove('a', { x: 13, y: 23 }, true));
  act(() => result.current.onUndo());
  expect(result.current.board.markers[0]).toMatchObject({ x: 10, y: 20 });
  act(() => result.current.onRedo());
  expect(result.current.board.markers[0]).toMatchObject({ x: 13, y: 23 });
  act(() => result.current.onMove('a', { x: 900, y: -10 }, false));
  expect(result.current.board.markers[0]).toMatchObject({ x: 70, y: 0 });
  act(() => result.current.onCancelMove());
  expect(result.current.board.markers[0]).toMatchObject({ x: 13, y: 23 });
  act(() =>
    result.current.onImport([
      { id: 'candidate', kind: 'neutral', label: '1', x: 30, y: 40 },
    ]),
  );
  expect(result.current.board.markers).toHaveLength(2);
  expect(result.current.board.markers[0].id).toBe('a');
});
