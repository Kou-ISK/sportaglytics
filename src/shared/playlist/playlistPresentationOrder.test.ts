import { expect, it } from 'vitest';
import type { Playlist } from '../../types/playlist/core';
import { applyPresentationOrder } from './playlistPresentationOrder';
import {
  getPresentationItems,
  normalizePlaylistDocument,
  reorderItemsWithinRow,
  reorderPlaylistRows,
} from './playlistDocument';
const fixture = (): Playlist => ({
  id: 'p',
  name: 'Review',
  type: 'reference',
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 2,
  rows: [
    { id: 'one', name: 'One', enabled: true, order: 0 },
    { id: 'two', name: 'Two', enabled: true, order: 1 },
  ],
  items: ['a', 'b', 'c'].map((id, index) => ({
    id,
    timelineItemId: null,
    actionName: id,
    startTime: 0,
    endTime: 1,
    addedAt: 0,
    rowId: index === 1 ? 'two' : 'one',
    rowOrder: index === 2 ? 1 : 0,
  })),
});
it('migrates row-first files and persists a cross-row sequence without moving row membership', () => {
  const migrated = normalizePlaylistDocument(fixture());
  expect(getPresentationItems(migrated).map((item) => item.id)).toEqual([
    'a',
    'c',
    'b',
  ]);
  const sorted = {
    ...migrated,
    items: applyPresentationOrder(migrated.items, ['b', 'c', 'a']),
  };
  const restored = normalizePlaylistDocument(sorted);
  expect(getPresentationItems(restored).map((item) => item.id)).toEqual([
    'b',
    'c',
    'a',
  ]);
  expect(restored.items.map((item) => item.rowId)).toEqual([
    'two',
    'one',
    'one',
  ]);
  expect(normalizePlaylistDocument(restored)).toEqual(restored);
  expect(
    getPresentationItems(reorderItemsWithinRow(restored, 'one', 0, 1)).map(
      (item) => item.id,
    ),
  ).toEqual(['b', 'a', 'c']);
  expect(
    getPresentationItems(reorderPlaylistRows(restored, 0, 1)).map(
      (item) => item.id,
    ),
  ).toEqual(['b', 'c', 'a']);
});
it('keeps the sorted sequence when new clips arrive or a clip is removed', () => {
  const base = fixture();
  const sorted = applyPresentationOrder(base.items, ['b', 'c', 'a']);
  const added = { ...base.items[0], id: 'new' };
  expect(
    getPresentationItems({ ...base, items: [...sorted, added] }).map(
      (item) => item.id,
    ),
  ).toEqual(['b', 'c', 'a', 'new']);
  expect(
    getPresentationItems({
      ...base,
      items: sorted.filter((item) => item.id !== 'c'),
    }).map((item) => item.id),
  ).toEqual(['b', 'a']);
});
it('rejects incomplete, duplicated or unknown permutations before changing clips', () => {
  const items = fixture().items;
  for (const ids of [['a'], ['a', 'a', 'b'], ['a', 'b', 'missing']])
    expect(() => applyPresentationOrder(items, ids)).toThrow();
  expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
});
