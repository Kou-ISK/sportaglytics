import React, { useCallback, useEffect, useState } from 'react';
import { TimelineData } from '../../../../../types/timeline/core';
import type { PlaylistItem } from '../../../../../types/playlist/core';
import type { AnalysisView } from '../../../../../types/analysis/view';
import { AnalysisPanelView } from './components/AnalysisPanelView';
import { useAnalysisPanelController } from './controllers/useAnalysisPanelController';
import { useAnalysisPanelState } from './hooks/useAnalysisPanelState';

interface AnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  view: AnalysisView;
  onViewChange?: (view: AnalysisView) => void;
  timeline: TimelineData[];
  teamNames: string[];
  onReviewInstances?: (items: TimelineData[]) => void;
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
  isSyncing?: boolean;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
}

export const AnalysisPanel = ({
  open,
  onClose,
  view,
  onViewChange,
  timeline,
  teamNames,
  onReviewInstances,
  onJumpToSegment,
  embedded = false,
  isSyncing = false,
  onCreateAiPlaylist,
}: AnalysisPanelProps) => {
  const [currentView, setCurrentView] = useState<AnalysisView>(view);

  useEffect(() => {
    setCurrentView(view);
  }, [view]);

  const handleChangeView = useCallback(
    (next: AnalysisView) => {
      setCurrentView(next);
      onViewChange?.(next);
    },
    [onViewChange],
  );

  const derivedState = useAnalysisPanelState({ timeline, teamNames });
  const viewProps = useAnalysisPanelController({
    open,
    onClose,
    currentView,
    onChangeView: handleChangeView,
    timeline,
    onReviewInstances,
    onJumpToSegment,
    embedded,
    isSyncing,
    onCreateAiPlaylist,
    ...derivedState,
  });

  return <AnalysisPanelView {...viewProps} />;
};
