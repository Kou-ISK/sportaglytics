import type { ClipExportAudioSelection } from '../../../../../../shared/clipExport/clipExportAudio';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineClipExportDialog } from './useTimelineClipExportDialog';
import { useTimelineLabelDialog } from './useTimelineLabelDialog';

interface UseTimelineExportDialogsParams {
  timeline: TimelineData[];
  selectedIds: string[];
  videoSources?: string[];
  audioSelections?: readonly ClipExportAudioSelection[];
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
  audioSelections,
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
    audioSelections,
    info,
  });

  return {
    ...labelDialog,
    ...clipExportDialog,
  };
};
