import type { PlaylistItem } from '../../../types/playlist/core';
import type { ClipExportScope } from '../../../shared/clipExport/clipExportTypes';

export interface PlaylistExportContent {
  includeEffects: boolean;
  includeSlides: boolean;
}

/** Common selection for the dialog, organizer preview and actual MP4 export. */
export function getPlaylistExportSelection(
  items: PlaylistItem[],
  selectedItems: PlaylistItem[],
  scope: ClipExportScope,
  includeSlides: boolean,
): {
  items: PlaylistItem[];
  availableSlideCount: number;
  hasVideo: boolean;
} {
  const scopedItems = scope === 'selected' ? selectedItems : items;
  const availableSlideCount = scopedItems.filter((item) => Boolean(item.slide)).length;
  return {
    items: includeSlides ? scopedItems : scopedItems.filter((item) => !item.slide),
    availableSlideCount,
    hasVideo: availableSlideCount < scopedItems.length,
  };
}
