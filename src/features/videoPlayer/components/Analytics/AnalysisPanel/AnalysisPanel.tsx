import React, { useCallback, useEffect, useState } from 'react';
import { TimelineData } from '../../../../../types/TimelineData';
import { AnalysisPanelView } from './view/AnalysisPanelView';
import { useAnalysisPanelState } from './hooks/useAnalysisPanelState';

export type AnalysisView =
  | 'dashboard'
  | 'momentum'
  | 'matrix'
  | 'ai';

interface AnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  view: AnalysisView;
  onViewChange?: (view: AnalysisView) => void;
  timeline: TimelineData[];
  teamNames: string[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
}

export const AnalysisPanel = ({
  open,
  onClose,
  view,
  onViewChange,
  timeline,
  teamNames,
  onJumpToSegment,
  embedded = false,
}: AnalysisPanelProps) => {
  const [currentView, setCurrentView] = useState<AnalysisView>(view);
  const derivedState = useAnalysisPanelState({ timeline, teamNames });

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

  return (
    <AnalysisPanelView
      open={open}
      onClose={onClose}
      currentView={currentView}
      onChangeView={handleChangeView}
      timeline={timeline}
      onJumpToSegment={onJumpToSegment}
      embedded={embedded}
      {...derivedState}
    />
  );
};
