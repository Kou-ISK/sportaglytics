import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisView } from '../../../types/AnalysisView';
import type { TimelineData } from '../../../types/TimelineData';
import type { PlaylistItem } from '../../../types/Playlist';
import { useAnalysisMenuHandlers } from './useAnalysisMenuHandlers';

interface UseAnalysisIntegrationParams {
  timeline: TimelineData[];
  teamNames: string[];
  videoList: string[];
  handleCurrentTime: (event: Event, time: number) => void;
  setIsVideoPlaying: (value: boolean | ((prev: boolean) => boolean)) => void;
}

interface UseAnalysisIntegrationResult {
  analysisOpen: boolean;
  setAnalysisOpen: (open: boolean) => void;
  analysisView: AnalysisView;
  setAnalysisView: (view: AnalysisView) => void;
  openAnalysisWindow: (nextView?: AnalysisView) => Promise<void>;
  handleJumpToSegment: (segment: TimelineData) => void;
  handleCreateAiPlaylist: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void>;
}

const wait = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const useAnalysisIntegration = ({
  timeline,
  teamNames,
  videoList,
  handleCurrentTime,
  setIsVideoPlaying,
}: UseAnalysisIntegrationParams): UseAnalysisIntegrationResult => {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisView, setAnalysisView] = useState<AnalysisView>('dashboard');

  const openAnalysisWindow = useCallback(
    async (nextView?: AnalysisView) => {
      const resolvedView = nextView ?? analysisView;
      setAnalysisView(resolvedView);
      const analysisApi = window.electronAPI?.analysis;
      if (analysisApi?.openWindow) {
        await analysisApi.openWindow();
        analysisApi.syncToWindow({
          timeline,
          teamNames,
          view: resolvedView,
        });
        setAnalysisOpen(false);
        return;
      }
      setAnalysisOpen(true);
    },
    [analysisView, timeline, teamNames],
  );

  useAnalysisMenuHandlers({
    onOpenAnalysis: (view) => {
      void openAnalysisWindow(view);
    },
  });

  const handleJumpToSegment = useCallback(
    (segment: TimelineData) => {
      const targetTime = Math.max(0, segment.startTime);
      handleCurrentTime(new Event('matrix-jump'), targetTime);
      setIsVideoPlaying(true);
      setAnalysisOpen(false);
    },
    [handleCurrentTime, setIsVideoPlaying],
  );

  const jumpHandlerRef = useRef(handleJumpToSegment);
  useEffect(() => {
    jumpHandlerRef.current = handleJumpToSegment;
  }, [handleJumpToSegment]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onAnalysisJumpToSegment) return;
    const unsubscribe = api.onAnalysisJumpToSegment((segment) => {
      jumpHandlerRef.current(segment);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const analysisApi = window.electronAPI?.analysis;
    if (!analysisApi?.syncToWindow) return;
    analysisApi.syncToWindow({ timeline, teamNames });
  }, [timeline, teamNames]);

  const handleCreateAiPlaylist = useCallback(
    async (payload: { name: string; items: PlaylistItem[] }) => {
      if (!payload?.items || payload.items.length === 0) return;

      const playlistApi = window.electronAPI?.playlist;
      if (!playlistApi) {
        console.debug('プレイリストAPIが利用できません。');
        return;
      }

      try {
        console.log(
          '[AI Playlist] Creating playlist with items:',
          payload.items.length,
        );

        const count = await playlistApi.getOpenWindowCount();
        if (count === 0) {
          await playlistApi.openWindow();
          await wait(500);
        }

        const list = videoList || [];
        for (let i = 0; i < payload.items.length; i += 1) {
          const item = payload.items[i];
          const playlistItem: PlaylistItem = {
            ...item,
            videoSource: list[0] || undefined,
            videoSource2: list[1] || undefined,
          };
          console.log(
            `[AI Playlist] Adding item ${i + 1}/${payload.items.length}:`,
            {
              actionName: playlistItem.actionName,
              startTime: playlistItem.startTime,
              endTime: playlistItem.endTime,
            },
          );
          await playlistApi.addItemToAllWindows(playlistItem);
        }
        console.log('[AI Playlist] Successfully added all items');
      } catch (error) {
        console.debug('AIプレイリストの作成に失敗しました。', error);
      }
    },
    [videoList],
  );

  const createPlaylistRef = useRef(handleCreateAiPlaylist);
  useEffect(() => {
    createPlaylistRef.current = handleCreateAiPlaylist;
  }, [handleCreateAiPlaylist]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onAnalysisCreateAiPlaylist) return;
    const unsubscribe = api.onAnalysisCreateAiPlaylist((payload) => {
      const data = payload as { name?: string; items?: PlaylistItem[] } | null;
      if (!data || !data.items) return;
      void createPlaylistRef.current({
        name: data.name || 'AI Review',
        items: data.items,
      });
    });
    return unsubscribe;
  }, []);

  return {
    analysisOpen,
    setAnalysisOpen,
    analysisView,
    setAnalysisView,
    openAnalysisWindow,
    handleJumpToSegment,
    handleCreateAiPlaylist,
  };
};
