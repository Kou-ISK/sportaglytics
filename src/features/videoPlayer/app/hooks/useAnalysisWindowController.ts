import { useCallback, useEffect, useState } from 'react';
import type { AnalysisView } from '../../../../types/analysis/view';
import type { TimelineData } from '../../../../types/timeline/core';
import type { AnalysisAiPlaylistPayload } from '../../../../types/ipc/analysisWindow';
import { useRawTimelineCsvExport } from '../../analysis/hooks/useRawTimelineCsvExport';
import {
  closeAnalysisWindow,
  sendAnalysisCreateAiPlaylist,
  sendAnalysisJumpToSegment,
  subscribeAnalysisWindowSync,
} from '../gateways/analysisWindowGateway';

interface UseAnalysisWindowControllerResult {
  timeline: TimelineData[];
  teamNames: string[];
  analysisView: AnalysisView;
  isSyncing: boolean;
  setAnalysisView: React.Dispatch<React.SetStateAction<AnalysisView>>;
  handleClose: () => void;
  handleJumpToSegment: (segment: TimelineData) => void;
  handleCreateAiPlaylist: (payload: AnalysisAiPlaylistPayload) => Promise<void>;
}

export const useAnalysisWindowController =
  (): UseAnalysisWindowControllerResult => {
    const [timeline, setTimeline] = useState<TimelineData[]>([]);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [analysisView, setAnalysisView] = useState<AnalysisView>('dashboard');
    const [isSyncing, setIsSyncing] = useState(true);

    useRawTimelineCsvExport({ timeline });

    useEffect(() => {
      const handleSync = (payload: {
        timeline: TimelineData[];
        teamNames: string[];
        view?: AnalysisView;
      }) => {
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

      return subscribeAnalysisWindowSync(handleSync);
    }, []);

    const handleClose = useCallback(() => {
      if (closeAnalysisWindow()) {
        return;
      }
      globalThis.window.close();
    }, []);

    const handleJumpToSegment = useCallback((segment: TimelineData) => {
      sendAnalysisJumpToSegment(segment);
    }, []);

    const handleCreateAiPlaylist = useCallback(
      async (payload: AnalysisAiPlaylistPayload) => {
        sendAnalysisCreateAiPlaylist(payload);
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
