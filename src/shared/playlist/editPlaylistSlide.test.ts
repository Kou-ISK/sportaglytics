import { describe, expect, it } from 'vitest';
import type { Playlist } from '../../types/playlist/core';
import { editPlaylistSlide } from './editPlaylistSlide';
import { getPresentationItems, normalizePlaylistDocument } from './playlistDocument';
import { isSlidePng } from './playlistSlide';

const doc = (): Playlist => normalizePlaylistDocument({
  id: 'meeting', name: 'Meeting', type: 'reference', createdAt: 1, updatedAt: 1,
  rows: ['A', 'B'].map((id, order) => ({ id, name: 'Theme', enabled: true, order })),
  items: ['A1', 'B1', 'A2'].map((id, presentationOrder) => ({
    id, timelineItemId: id, startTime: 1, endTime: 3, addedAt: 1, actionName: 'One',
    rowId: id[0], presentationOrder, videoSource: 'match.mp4', defaultAngle: 'angle2',
  })),
});
const slide = { title: 'Review', body: 'Watch both angles.' };

describe('meeting slide placement and persistence', () => {
  it('retains editable content and duration between clips and after reload', () => {
    const after = editPlaylistSlide(doc(), { rowId: 'A', afterId: 'A1' }, slide, 4);
    const items = getPresentationItems(JSON.parse(JSON.stringify(after)));
    expect(items.map((item) => item.slide ? 'slide' : item.id)).toEqual(['A1', 'slide', 'B1', 'A2']);
    expect(items[1]).toMatchObject({ startTime: 0, endTime: 4, rowId: 'A', slide });
    expect(items[1].videoSource).toBeUndefined();
    expect(items[3].defaultAngle).toBe('angle2');
    expect(editPlaylistSlide(after, { rowId: 'A', editId: items[1].id }, slide, 4)).toBe(after);
  });

  it('inserts at the start of the chosen row and rejects stale anchors', () => {
    const original = doc();
    const inserted = editPlaylistSlide(original, { rowId: 'B' }, slide, 3);
    expect(inserted.items.map((item) => item.slide ? 'slide' : item.id)).toEqual(['A1', 'slide', 'B1', 'A2']);
    expect(editPlaylistSlide(original, { rowId: 'B', afterId: 'A2' }, slide, 3)).toBe(original);
  });

  it('preserves a note and independent row order when inserting or editing a slide', () => {
    const original = doc();
    original.items = original.items.map((clip) => ({
      ...clip, rowOrder: clip.id === 'A1' ? 1 : 0,
    }));
    const inserted = editPlaylistSlide(original, { rowId: 'B' }, slide, 3);
    const entry = inserted.items.find((clip) => clip.slide);
    if (!entry) throw new Error('missing slide');
    const noted = { ...inserted, items: inserted.items.map((clip) =>
      clip.id === entry.id ? { ...clip, note: 'Discussion prompt' } : clip) };
    const edited = editPlaylistSlide(noted, { rowId: 'B', editId: entry.id }, { ...slide, title: 'Next question' }, 5);
    expect(edited.items.find((clip) => clip.id === entry.id)?.note).toBe('Discussion prompt');
    expect(edited.items.filter((clip) => clip.rowId === 'A').map((clip) => [clip.id, clip.rowOrder]))
      .toEqual([['A1', 1], ['A2', 0]]);
  });

  it('rejects invalid duration and external images before storing a slide', () => {
    expect(isSlidePng('https://example.invalid/meeting.png')).toBe(false);
    expect(() => editPlaylistSlide(doc(), { rowId: 'A' }, slide, 0)).toThrow();
    expect(() => editPlaylistSlide(doc(), { rowId: 'A' }, { ...slide, image: 'file:///icon' }, 1)).toThrow();
  });
});
