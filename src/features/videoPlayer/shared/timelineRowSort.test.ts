import { describe, expect, it } from 'vitest';
import type { TimelineData, TimelineRow } from '../../../types/timeline/core';
import { moveTimelineRowInList } from './timelineRows';
import {
  buildTimelineRowSortMoves,
  sortTimelineRows,
} from './timelineRowSort';

const rows: TimelineRow[] = [
  { id: 'row-b', name: 'Breakdown 2', color: '#222222' },
  { id: 'row-a', name: 'Attack', color: '#111111' },
  { id: 'row-c', name: 'Breakdown 10', color: '#222222' },
  { id: 'row-d', name: 'Defence', color: '#111111' },
];

const timeline: TimelineData[] = [
  { id: 'a1', actionName: 'Attack', startTime: 0, endTime: 1, memo: '' },
  { id: 'a2', actionName: 'Attack', startTime: 1, endTime: 2, memo: '' },
  { id: 'b1', actionName: 'Breakdown 2', startTime: 2, endTime: 3, memo: '' },
];

describe('sortTimelineRows', () => {
  it('sorts names in explicit natural ascending order', () => {
    expect(
      sortTimelineRows(rows, timeline, { criterion: 'name', direction: 'asc' }).map(
        (row) => row.name,
      ),
    ).toEqual(['Attack', 'Breakdown 2', 'Breakdown 10', 'Defence']);
  });

  it('sorts names in explicit descending order', () => {
    expect(
      sortTimelineRows(rows, timeline, {
        criterion: 'name',
        direction: 'desc',
      }).map((row) => row.name),
    ).toEqual(['Defence', 'Breakdown 10', 'Breakdown 2', 'Attack']);
  });

  it('sorts by instance count with deterministic name ties', () => {
    expect(
      sortTimelineRows(rows, timeline, {
        criterion: 'instanceCount',
        direction: 'desc',
      }).map((row) => row.name),
    ).toEqual(['Attack', 'Breakdown 2', 'Defence', 'Breakdown 10']);
  });

  it('groups equal colors without inventing an undocumented color spectrum order', () => {
    expect(
      sortTimelineRows(rows, timeline, { criterion: 'color' }).map(
        (row) => row.name,
      ),
    ).toEqual(['Breakdown 2', 'Breakdown 10', 'Attack', 'Defence']);
  });

  it('does not mutate the persisted input row array', () => {
    const original = rows.map((row) => row.id);
    sortTimelineRows(rows, timeline, { criterion: 'name', direction: 'asc' });
    expect(rows.map((row) => row.id)).toEqual(original);
  });

  it('builds move operations that reproduce the desired persisted order', () => {
    const spec = { criterion: 'name', direction: 'asc' } as const;
    const moves = buildTimelineRowSortMoves(rows, timeline, spec);
    const reordered = moves.reduce(
      (current, move) =>
        moveTimelineRowInList(current, move.sourceId, move.targetId),
      rows,
    );

    expect(reordered).toEqual(sortTimelineRows(rows, timeline, spec));
  });
});
