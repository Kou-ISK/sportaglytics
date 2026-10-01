import React from 'react';
import { useVisualTimelineController } from './hooks/useVisualTimelineController';
import { VisualTimelineView } from './VisualTimelineView';
import type { VisualTimelineProps } from './VisualTimeline.types';
import { useTimelineReview } from './review/useTimelineReview';
import { TimelineWorkspaceView } from './review/TimelineWorkspaceView';

export const VisualTimeline: React.FC<VisualTimelineProps> = (props) => {
  const viewProps = useVisualTimelineController(props);
  const review = useTimelineReview(props.timeline, props.selectedIds);

  return (
    <TimelineWorkspaceView
      review={{
        ...review,
        formatTime: viewProps.formatTime,
        onActivate: viewProps.onRevealItem,
        onEdit: viewProps.onEditItem,
        onAddToPlaylist: props.onAddToPlaylist,
      }}
    >
      <VisualTimelineView
        {...viewProps}
        angleSync={props.angleSync}
        review={review}
      />
    </TimelineWorkspaceView>
  );
};
