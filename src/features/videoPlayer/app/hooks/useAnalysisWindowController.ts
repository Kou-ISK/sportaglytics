import { useCallback, useEffect, useState } from 'react';
import type { AnalysisView } from '../../../../types/AnalysisView';
import type { TimelineData } from '../../../../types/TimelineData';
import type { PlaylistItem } from '../../../../types/Playlist';
import type { AnalysisWindowSyncPayload } from '../../../../renderer';
import { useRawTimelineCsvExport } from '../../analysis/hooks/useRawTimelineCsvExport';

interface UseAnalysisWindowControllerResult {
  timeline: TimelineData[];
  teamNames: string[];
  analysisView: AnalysisView;
  isSyncing: boolean;
  setAnalysisView: React.Dispatch<React.SetStateAction<AnalysisView>>;
  handleClose: () => void;
  handleJumpToSegment: (segment: TimelineData) => void;
  handleCreateAiPlaylist: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void>;
}

export const useAnalysisWindowController =
  (): UseAnalysisWindowControllerResult => {
    const [timeline, setTimeline] = useState<TimelineData[]>([]);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [analysisView, setAnalysisView] = useState<AnalysisView>('dashboard');
    const [isSyncing, setIsSyncing] = useState(true);

    useRawTimelineCsvExport({ timeline });

    useEffect(() => {
      const api = globalThis.window.electronAPI?.analysis;
      if (!api?.onSync) {
        return;
      }

      const handleSync = (payload: AnalysisWindowSyncPayload) => {
        if (!payload) {
          return;
        }
        setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
        setTeamNames(Array.isArray(payload.teamNames) ? payload.teamNames : []);
        if (payload.view) {
          setAnalysisView(payload.view);
        }
        setIsSyncing(false);
      };

      api.onSync(handleSync);
      return () => api.offSync?.(handleSync);
    }, []);

    const handleClose = useCallback(() => {
      const api = globalThis.window.electronAPI?.analysis;
      if (api?.closeWindow) {
        api.closeWindow();
        return;
      }
      globalThis.window.close();
    }, []);

    const handleJumpToSegment = useCallback((segment: TimelineData) => {
      globalThis.window.electronAPI?.analysis?.sendJumpToSegment(segment);
    }, []);

    const handleCreateAiPlaylist = useCallback(
      async (payload: { name: string; items: PlaylistItem[] }) => {
        if (!globalThis.window.electronAPI?.analysis?.sendCreateAiPlaylist) {
          return;
        }
        globalThis.window.electronAPI.analysis.sendCreateAiPlaylist(payload);
      },
      [],
    );

    return {
      timeline,
      teamNames,
      analysisView,
      isSyncing,
      setAnalysisView,
      handleClose,
      handleJumpToSegment,
      handleCreateAiPlaylist,
    };
  };
