import { TimelineWindowView } from './components/TimelineWindowView';
import { useTimelineWindowController } from './hooks/useTimelineWindowController';

export const TimelineWindowScreen = () => {
  const controller = useTimelineWindowController();
  return <TimelineWindowView controller={controller} />;
};
