import { useCallback, useEffect } from 'react';
import { usePlaylist } from '../../../contexts/PlaylistContext';
import type { PlaylistItem } from '../../../types/Playlist';
import type { TimelineData } from '../../../types/TimelineData';

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
      const playlistApi = window.electronAPI?.playlist;
      if (!playlistApi) {
        console.debug(
          'プレイリストAPIが利用できないため、追加を中止しました。',
        );
        return;
      }

      try {
        const list = videoList || [];
        const count = await playlistApi.getOpenWindowCount();

        if (count === 0) {
          await playlistApi.openWindow();
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
        }

        for (const item of items) {
          const playlistItem: PlaylistItem = {
            id: crypto.randomUUID(),
            timelineItemId: item.id,
            actionName: item.actionName,
            startTime: item.startTime,
            endTime: item.endTime,
            labels: item.labels,
            memo: item.memo,
            addedAt: Date.now(),
            videoSource: list[0] || undefined,
            videoSource2: list[1] || undefined,
          };
          await playlistApi.addItemToAllWindows(playlistItem);
        }
      } catch (error) {
        console.debug('プレイリストへの追加でエラーが発生しました。', error);
      }
    },
    [videoList],
  );

  return { handleAddToPlaylist };
};
