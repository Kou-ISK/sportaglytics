import type {
  TimelineData,
  TimelineRow,
} from '../../../../../types/timeline/core';

export interface VisualTimelineProps {
  timeline: TimelineData[];
  rows: TimelineRow[];
  maxSec: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onDelete: (ids: string[]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdateMemo?: (id: string, memo: string) => void;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  bulkUpdateTimelineItems?: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  onDuplicateTimelineItem?: (id: string) => string | null;
  onCreateTimelineItem?: (
    actionName: string,
    startTime: number,
    endTime: number,
    color: string,
  ) => void;
  onAddRow?: (name?: string, color?: string) => void;
  onUpdateRow?: (
    id: string,
    updates: Pick<TimelineRow, 'name' | 'color'>,
  ) => void;
  onMoveRow?: (sourceId: string, targetId: string) => void;
  onDeleteRows?: (ids: string[]) => void;
  onPasteTimelineItemsToRow?: (
    items: TimelineData[],
    targetRowId: string,
  ) => string[];
  teamNames: string[];
  videoSources?: string[];
  onUndo?: () => void;
  onRedo?: () => void;
  onAddToPlaylist?: (items: TimelineData[]) => void;
}
