import React from 'react';
import { useVisualTimelineController } from './hooks/useVisualTimelineController';
import { VisualTimelineView } from './VisualTimelineView';
import type { VisualTimelineProps } from './VisualTimeline.types';

export const VisualTimeline: React.FC<VisualTimelineProps> = (props) => {
  const viewProps = useVisualTimelineController(props);

  return <VisualTimelineView {...viewProps} />;
};
