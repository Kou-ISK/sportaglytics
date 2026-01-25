import React, { useCallback, useEffect, useState } from 'react';
import { TimelineData } from '../../../../../types/TimelineData';
import { StatsPanelView } from './view/StatsPanelView';
import { useStatsPanelState } from './hooks/useStatsPanelState';

export type StatsView =
  | 'dashboard'
  | 'possession'
  | 'results'
  | 'types'
  | 'momentum'
  | 'matrix'
  | 'custom';

interface StatsPanelProps {
  open: boolean;
  onClose: () => void;
  view: StatsView;
  onViewChange?: (view: StatsView) => void;
  timeline: TimelineData[];
  teamNames: string[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
}

export const StatsPanel = ({
  open,
  onClose,
  view,
  onViewChange,
  timeline,
  teamNames,
  onJumpToSegment,
  embedded = false,
}: StatsPanelProps) => {
  const [currentView, setCurrentView] = useState<StatsView>(view);
  const derivedState = useStatsPanelState({ timeline, teamNames });

  useEffect(() => {
    setCurrentView(view);
  }, [view]);

  const handleChangeView = useCallback(
    (next: StatsView) => {
      setCurrentView(next);
      onViewChange?.(next);
    },
    [onViewChange],
  );

  return (
    <StatsPanelView
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
