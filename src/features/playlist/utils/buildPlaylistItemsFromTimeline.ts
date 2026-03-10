import type { PlaylistItem } from '../../../types/Playlist';
import type { TimelineData } from '../../../types/TimelineData';

interface VideoSourcePair {
  primary?: string | null;
  secondary?: string | null;
}

interface BuildPlaylistItemsOptions {
  now?: () => number;
  createId?: () => string;
  videoSources?: VideoSourcePair;
}

export const buildPlaylistItemsFromTimeline = (
  items: TimelineData[],
  options: BuildPlaylistItemsOptions = {},
): PlaylistItem[] => {
  const now = options.now ?? Date.now;
  const createId = options.createId ?? (() => crypto.randomUUID());
  const addedAt = now();

  return items.map((item) => ({
    id: createId(),
    timelineItemId: item.id,
    actionName: item.actionName,
    startTime: item.startTime,
    endTime: item.endTime,
    labels: item.labels,
    memo: item.memo,
    addedAt,
    videoSource: options.videoSources?.primary ?? undefined,
    videoSource2: options.videoSources?.secondary ?? undefined,
  }));
};
