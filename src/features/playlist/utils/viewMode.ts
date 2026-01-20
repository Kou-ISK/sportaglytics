import type { PlaylistItem } from '../../../types/Playlist';

export const resolveViewModeForSources = (
  videoSources: string[],
): 'dual' | 'angle1' => {
  return videoSources.length >= 2 ? 'dual' : 'angle1';
};

export const resolveViewModeForItems = (
  items: PlaylistItem[],
  playingItemId: string | null,
): 'dual' | 'angle1' => {
  const current = items.find((it) => it.id === playingItemId);
  const hasDual = !!(
    current?.videoSource2 || items.some((it) => !!it.videoSource2)
  );
  return hasDual ? 'dual' : 'angle1';
};
