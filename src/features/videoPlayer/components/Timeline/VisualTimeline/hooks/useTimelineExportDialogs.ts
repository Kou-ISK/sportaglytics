import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineClipExportDialog } from './useTimelineClipExportDialog';
import { useTimelineLabelDialog } from './useTimelineLabelDialog';

interface UseTimelineExportDialogsParams {
  timeline: TimelineData[];
  selectedIds: string[];
  videoSources?: string[];
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  info: (message: string) => void;
}

export const useTimelineExportDialogs = ({
  timeline,
  selectedIds,
  videoSources,
  onUpdateTimelineItem,
  info,
}: UseTimelineExportDialogsParams) => {
  const labelDialog = useTimelineLabelDialog({
    timeline,
    selectedIds,
    onUpdateTimelineItem,
    info,
  });

  const clipExportDialog = useTimelineClipExportDialog({
    timeline,
    selectedIds,
    videoSources,
    info,
  });

  return {
    ...labelDialog,
    ...clipExportDialog,
  };
};
