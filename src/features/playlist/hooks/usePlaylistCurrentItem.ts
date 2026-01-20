import { useMemo } from 'react';
import type { PlaylistItem } from '../../../types/Playlist';

interface UsePlaylistCurrentItemParams {
  items: PlaylistItem[];
  currentIndex: number;
  videoSources: string[];
  duration: number;
  editingItemId: string | null;
}

interface UsePlaylistCurrentItemResult {
  currentItem: PlaylistItem | null;
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  sliderMin: number;
  sliderMax: number;
  editingItem: PlaylistItem | null;
}

export const usePlaylistCurrentItem = ({
  items,
  currentIndex,
  videoSources,
  duration,
  editingItemId,
}: UsePlaylistCurrentItemParams): UsePlaylistCurrentItemResult => {
  const currentItem = useMemo(() => {
    return currentIndex >= 0 && currentIndex < items.length
      ? items[currentIndex]
      : null;
  }, [currentIndex, items]);

  const currentVideoSource = useMemo(() => {
    if (!currentItem) return null;
    return currentItem.videoSource || videoSources[0] || null;
  }, [currentItem, videoSources]);

  const currentVideoSource2 = useMemo(() => {
    if (!currentItem) return null;
    return currentItem.videoSource2 || videoSources[1] || null;
  }, [currentItem, videoSources]);

  const sliderMin = currentItem?.startTime ?? 0;
  const sliderMax = currentItem?.endTime ?? duration;

  const editingItem = useMemo(() => {
    return editingItemId ? items.find((i) => i.id === editingItemId) ?? null : null;
  }, [editingItemId, items]);

  return {
    currentItem,
    currentVideoSource,
    currentVideoSource2,
    sliderMin,
    sliderMax,
    editingItem,
  };
};
