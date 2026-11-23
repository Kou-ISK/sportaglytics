import type { Playlist, PlaylistItem, PlaylistSlide } from '../../types/playlist/core';
import { getPresentationItems } from './playlistDocument';
import { validateSlideItem } from './playlistSlide';

export interface SlidePlacement {
  rowId: string;
  afterId?: string;
  editId?: string;
}

/** Insert in presentation order. A row with no clip yet appends to the meeting. */
export const editPlaylistSlide = (
  document: Playlist, placement: SlidePlacement, slide: PlaylistSlide, seconds: number,
): Playlist => {
  if (!document.rows?.some((row) => row.id === placement.rowId)) return document;
  const ordered = getPresentationItems(document);
  const previous = ordered.find((item) => item.id === placement.editId);
  if (placement.editId && (!previous?.slide || previous.rowId !== placement.rowId)) return document;
  if (previous?.slide && previous.slide.title === slide.title &&
      previous.slide.body === slide.body && previous.slide.image === slide.image &&
      previous.endTime === seconds) return document;
  const item: PlaylistItem = {
    ...previous,
    id: previous?.id ?? crypto.randomUUID(), addedAt: previous?.addedAt ?? Date.now(),
    timelineItemId: null, rowId: placement.rowId, actionName: slide.title,
    slide, startTime: 0, endTime: seconds,
  };
  validateSlideItem(item);
  if (previous) return {
    ...document, items: document.items.map((clip) => clip.id === previous.id ? { ...clip, ...item } : clip),
  };

  const anchor = ordered.findIndex((clip) => clip.id === placement.afterId && clip.rowId === placement.rowId);
  if (placement.afterId && anchor < 0) return document;
  const first = ordered.findIndex((clip) => clip.rowId === placement.rowId);
  const position = anchor >= 0 ? anchor + 1 : first >= 0 ? first : ordered.length;
  const rowOrder = anchor >= 0 ? (ordered[anchor].rowOrder ?? 0) + 1 : 0;
  const shifted = ordered.map((clip) => clip.rowId === placement.rowId && (clip.rowOrder ?? 0) >= rowOrder
    ? { ...clip, rowOrder: (clip.rowOrder ?? 0) + 1 } : clip);
  shifted.splice(position, 0, { ...item, rowOrder });
  return { ...document, items: shifted.map((clip, presentationOrder) => ({ ...clip, presentationOrder })) };
};
