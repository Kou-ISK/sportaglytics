import type { PlaylistItem, PlaylistRow } from '../../types/playlist/core';

const rank = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : Infinity;

/** v1/v2 keep their row order; v3 keeps the explicit cross-row sequence. New clips append. */
export const normalizePresentationOrder = (
  items: PlaylistItem[],
  rows: PlaylistRow[],
): PlaylistItem[] => {
  const rowRanks = new Map(rows.map((row) => [row.id, row.order]));
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        rank(a.item.presentationOrder) - rank(b.item.presentationOrder) ||
        rank(rowRanks.get(a.item.rowId ?? '')) -
          rank(rowRanks.get(b.item.rowId ?? '')) ||
        rank(a.item.rowOrder) - rank(b.item.rowOrder) ||
        a.index - b.index,
    );
  const orderById = new Map(ordered.map(({ item }, index) => [item.id, index]));
  return items.map((item) => ({
    ...item,
    presentationOrder: orderById.get(item.id),
  }));
};

/** One document edit. Keeps IDs, row membership and annotations; updates row-local order too. */
export const applyPresentationOrder = (
  items: PlaylistItem[],
  orderedIds: string[],
): PlaylistItem[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (
    orderedIds.length !== items.length ||
    new Set(orderedIds).size !== items.length ||
    orderedIds.some((id) => !byId.has(id))
  ) {
    throw new Error('Playlist order must contain every clip exactly once');
  }
  const rowCounts = new Map<string | undefined, number>();
  return orderedIds.map((id, presentationOrder) => {
    const item = byId.get(id);
    if (!item) throw new Error('Playlist clip is missing');
    const rowOrder = rowCounts.get(item.rowId) ?? 0;
    rowCounts.set(item.rowId, rowOrder + 1);
    return { ...item, presentationOrder, rowOrder };
  });
};
