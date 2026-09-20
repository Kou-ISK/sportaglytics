import { expect, it } from 'vitest';
import { validateTacticsAnnotation } from './annotationValidation';
import { isValidTacticalBoard } from './tacticalBoard';
import type { TacticalBoard } from '../../types/playlist/tacticalBoard';
const board: TacticalBoard = {
  widthMeters: 70,
  lengthMeters: 100,
  time: 4,
  markers: [{ id: 'p', kind: 'team1', label: '9', x: 20, y: 30 }],
  arrows: [{ id: 'a', from: { x: 20, y: 30 }, to: { x: 40, y: 60 } }],
};
it('preserves a board through JSON and rejects corrupted coordinates, IDs, kinds and oversized payloads', () => {
  const restored: unknown = JSON.parse(JSON.stringify(board));
  expect(isValidTacticalBoard(restored)).toBe(true);
  for (const invalid of [
    { ...board, time: -1 },
    { ...board, markers: [{ ...board.markers[0], x: Number.NaN }] },
    { ...board, markers: [{ ...board.markers[0], x: 71 }] },
    { ...board, markers: [{ ...board.markers[0], kind: 'referee' }] },
    { ...board, markers: [board.markers[0], board.markers[0]] },
    { ...board, arrows: [{ ...board.arrows[0], id: 'p' }] },
    {
      ...board,
      markers: Array.from({ length: 65 }, (_, i) => ({
        ...board.markers[0],
        id: String(i),
      })),
    },
  ])
    expect(isValidTacticalBoard(invalid)).toBe(false);
  expect(() =>
    validateTacticsAnnotation({
      objects: [],
      freezeAt: 0,
      freezeDuration: 3,
      tacticalBoard: { primary: board },
    }),
  ).not.toThrow();
  expect(() =>
    validateTacticsAnnotation({
      objects: [],
      freezeAt: 0,
      freezeDuration: 3,
      tacticalBoard: { primary: { ...board, widthMeters: 0 } },
    }),
  ).toThrow('戦術盤');
});
