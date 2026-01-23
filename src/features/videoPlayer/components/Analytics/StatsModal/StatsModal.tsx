import React, { useCallback, useEffect, useState } from 'react';
import { TimelineData } from '../../../../../types/TimelineData';
import { StatsModalView } from './view/StatsModalView';
import { useStatsModalState } from './hooks/useStatsModalState';

export type StatsView =
  | 'possession'
  | 'results'
  | 'types'
  | 'momentum'
  | 'matrix'
  | 'custom';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  view: StatsView;
  onViewChange?: (view: StatsView) => void;
  timeline: TimelineData[];
  teamNames: string[];
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const StatsModal = ({
  open,
  onClose,
  view,
  onViewChange,
  timeline,
  teamNames,
  onJumpToSegment,
}: StatsModalProps) => {
  const [currentView, setCurrentView] = useState<StatsView>(view);
  const derivedState = useStatsModalState({ timeline, teamNames });

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
    <StatsModalView
      open={open}
      onClose={onClose}
      currentView={currentView}
      onChangeView={handleChangeView}
      timeline={timeline}
      onJumpToSegment={onJumpToSegment}
      {...derivedState}
    />
  );
};
