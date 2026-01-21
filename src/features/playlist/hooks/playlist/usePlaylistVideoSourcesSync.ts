import { useEffect } from 'react';
import type { PlaylistItem } from '../../../../types/Playlist';
import { arrayShallowEqual } from '../../utils/arrayEqual';

interface UsePlaylistVideoSourcesSyncParams {
  currentItem: PlaylistItem | null;
  videoSources: string[];
  setVideoSources: React.Dispatch<React.SetStateAction<string[]>>;
}

export const usePlaylistVideoSourcesSync = ({
  currentItem,
  videoSources,
  setVideoSources,
}: UsePlaylistVideoSourcesSyncParams) => {
  useEffect(() => {
    if (!currentItem) return;
    const merged: string[] = [];
    if (currentItem.videoSource) merged.push(currentItem.videoSource);
    if (currentItem.videoSource2) merged.push(currentItem.videoSource2);
    if (!currentItem.videoSource && videoSources[0]) {
      merged.unshift(videoSources[0]);
    }
    if (!currentItem.videoSource2 && videoSources[1]) {
      if (merged.length === 0) merged.push('');
      merged[1] = videoSources[1];
    }
    const cleaned = merged.filter(Boolean);
    if (cleaned.length && !arrayShallowEqual(cleaned, videoSources)) {
      setVideoSources(cleaned);
    }
  }, [currentItem, setVideoSources, videoSources]);
};
