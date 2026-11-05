import type { PlaylistItem } from '../../types/playlist/core';

const fields = [
  'videoSource',
  'videoSource2',
  'mediaReference',
  'mediaReference2',
] as const;
export const playlistMediaKey = (item: PlaylistItem): string =>
  JSON.stringify(fields.map((field) => item[field]));

/** Relative package locations are derived from the playlist's current path. */
export const playlistMediaContentKey = (item: PlaylistItem): string => {
  const reference = (value: PlaylistItem['mediaReference']): unknown => {
    if (!value) return value;
    const { relativePackagePath: _derived, ...content } = value;
    return content;
  };
  return JSON.stringify([
    item.videoSource,
    item.videoSource2,
    reference(item.mediaReference),
    reference(item.mediaReference2),
  ]);
};

/** Merge only source metadata; never roll back notes, angles, order or Paint edited during IPC. */
export const reconcilePlaylistMedia = (
  items: PlaylistItem[],
  requested: PlaylistItem[],
  resolved: PlaylistItem[],
): PlaylistItem[] => {
  const before = new Map(requested.map((item) => [item.id, item]));
  const after = new Map(resolved.map((item) => [item.id, item]));
  let changed = false;
  const result = items.map((item) => {
    const previous = before.get(item.id);
    const update = after.get(item.id);
    if (
      !previous ||
      !update ||
      playlistMediaKey(item) !== playlistMediaKey(previous) ||
      playlistMediaKey(item) === playlistMediaKey(update)
    )
      return item;
    changed = true;
    return {
      ...item,
      videoSource: update.videoSource,
      videoSource2: update.videoSource2,
      mediaReference: update.mediaReference,
      mediaReference2: update.mediaReference2,
    };
  });
  return changed ? result : items;
};
