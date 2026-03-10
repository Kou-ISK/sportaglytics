import { useCallback, useEffect } from 'react';
import type { PlaylistItem } from '../../../../types/Playlist';
import type { TimelineData } from '../../../../types/TimelineData';
import { usePlaylist } from '../../../playlist';

type PlaylistIntegrationParams = {
  currentTime: number;
  videoList: string[];
  handleCurrentTime: (event: Event, time: number) => void;
  setIsVideoPlaying: (value: boolean | ((prev: boolean) => boolean)) => void;
};

type PlaylistIntegrationResult = {
  handleAddToPlaylist: (items: TimelineData[]) => Promise<void>;
};

export const usePlaylistIntegration = ({
  currentTime,
  videoList,
  handleCurrentTime,
  setIsVideoPlaying,
}: PlaylistIntegrationParams): PlaylistIntegrationResult => {
  const {
    registerSeekCallback,
    registerPlayItemCallback,
    syncToWindow,
    addTimelineItemsToAllWindows,
    isWindowOpen,
    state: playlistState,
  } = usePlaylist();

  const handlePlaylistSeek = useCallback(
    (time: number) => {
      handleCurrentTime(new Event('playlist-seek'), time);
    },
    [handleCurrentTime],
  );

  const handlePlaylistPlayItem = useCallback(
    (item: PlaylistItem) => {
      // アイテムの開始時間へジャンプして再生開始
      handleCurrentTime(new Event('playlist-play'), item.startTime);
      setIsVideoPlaying(true);
    },
    [handleCurrentTime, setIsVideoPlaying],
  );

  useEffect(() => {
    registerSeekCallback(handlePlaylistSeek);
    registerPlayItemCallback(handlePlaylistPlayItem);
  }, [
    registerSeekCallback,
    registerPlayItemCallback,
    handlePlaylistSeek,
    handlePlaylistPlayItem,
  ]);

  useEffect(() => {
    if (!isWindowOpen) return;

    const videoPath = videoList.length > 0 ? videoList[0] : null;
    const videoPath2 = videoList.length > 1 ? videoList[1] : null;
    const packagePath = videoPath
      ? videoPath.substring(0, videoPath.lastIndexOf('/'))
      : undefined;
    syncToWindow(currentTime, videoPath, videoPath2, packagePath);
  }, [isWindowOpen, playlistState, currentTime, videoList, syncToWindow]);

  const handleAddToPlaylist = useCallback(
    async (items: TimelineData[]) => {
      await addTimelineItemsToAllWindows(items, {
        primary: videoList[0],
        secondary: videoList[1],
      });
    },
    [addTimelineItemsToAllWindows, videoList],
  );

  return { handleAddToPlaylist };
};
