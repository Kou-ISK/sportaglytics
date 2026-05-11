import React from 'react';
import { TimelineLaneView } from './TimelineLaneView';
import { useTimelineLaneController } from './hooks/useTimelineLaneController';
import type { TimelineLaneProps } from './TimelineLane.types';

export const TimelineLane: React.FC<TimelineLaneProps> = (props) => {
  const viewProps = useTimelineLaneController(props);
  return <TimelineLaneView {...viewProps} />;
};
