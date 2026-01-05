import { useCallback, useState } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';
import { TimelineEditDraft } from '../TimelineEditDialog';

interface UseTimelineEditDraftParams {
  timeline: TimelineData[];
  onDelete: (ids: string[]) => void;
  onSeek: (time: number) => void;
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  onUpdateQualifier?: (id: string, qualifier: string) => void;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
}

// Dialog用: draftを操作する軽量フック（元のAPIを維持）
export const useTimelineEditDraft = ({
  draft,
  onChange,
}: {
  draft: TimelineEditDraft | null;
  onChange: (changes: Partial<TimelineEditDraft>) => void;
}) => {
  const safeStartTime =
    draft?.startTime ??
    (draft?.originalStartTime !== undefined
      ? draft.originalStartTime.toString()
      : '');
  const safeEndTime =
    draft?.endTime ??
    (draft?.originalEndTime !== undefined
      ? draft.originalEndTime.toString()
      : '');
  const qualifier = draft?.qualifier ?? '';

  const setStartTime = (value: string) => onChange({ startTime: value });
  const setEndTime = (value: string) => onChange({ endTime: value });
  const setQualifier = (value: string) => onChange({ qualifier: value });

  return {
    safeStartTime,
    safeEndTime,
    qualifier,
    setStartTime,
    setEndTime,
    setQualifier,
  };
};

export const useTimelineEditActions = ({
  timeline,
  onDelete,
  onSeek,
  onUpdateTimelineItem,
  onUpdateQualifier,
  onUpdateTimeRange,
}: UseTimelineEditDraftParams) => {
  const [editingDraft, setEditingDraft] = useState<TimelineEditDraft | null>(
    null,
  );

  const openDraftFromItemId = useCallback(
    (itemId: string) => {
      const item = timeline.find((entry) => entry.id === itemId);
      if (!item) return;
      setEditingDraft({
        id: item.id,
        actionName: item.actionName,
        qualifier: item.qualifier || '',
        labels: item.labels || [],
        startTime: item.startTime.toString(),
        endTime: item.endTime.toString(),
        originalStartTime: item.startTime,
        originalEndTime: item.endTime,
      });
    },
    [timeline],
  );

  const handleDialogChange = useCallback(
    (changes: Partial<TimelineEditDraft>) => {
      setEditingDraft((prev) => (prev ? { ...prev, ...changes } : prev));
    },
    [],
  );

  const handleCloseDialog = useCallback(() => {
    setEditingDraft(null);
  }, []);

  const handleDeleteSingle = useCallback(() => {
    if (!editingDraft) return;
    onDelete([editingDraft.id]);
    setEditingDraft(null);
  }, [editingDraft, onDelete]);

  const handleSaveDialog = useCallback(() => {
    if (!editingDraft) return;

    const parsedStart = Number(editingDraft.startTime);
    const parsedEnd = Number(editingDraft.endTime);

    const safeStart = Number.isFinite(parsedStart)
      ? Math.max(0, parsedStart)
      : editingDraft.originalStartTime;
    const safeEndSource = Number.isFinite(parsedEnd)
      ? parsedEnd
      : editingDraft.originalEndTime;
    const safeEnd = Math.max(safeStart, safeEndSource);

    if (onUpdateTimelineItem) {
      onUpdateTimelineItem(editingDraft.id, {
        qualifier: editingDraft.qualifier,
        labels: editingDraft.labels,
        startTime: safeStart,
        endTime: safeEnd,
      });
    } else {
      if (onUpdateQualifier) {
        onUpdateQualifier(editingDraft.id, editingDraft.qualifier);
      }
      if (onUpdateTimeRange) {
        onUpdateTimeRange(editingDraft.id, safeStart, safeEnd);
      }
    }

    setEditingDraft(null);
  }, [
    editingDraft,
    onUpdateQualifier,
    onUpdateTimeRange,
    onUpdateTimelineItem,
  ]);

  const handleContextMenuJumpTo = useCallback(
    (itemId: string) => {
      const item = timeline.find((entry) => entry.id === itemId);
      if (!item) return;
      onSeek(item.startTime);
    },
    [timeline, onSeek],
  );

  const handleContextMenuDuplicate = useCallback(
    (itemId: string) => {
      const item = timeline.find((entry) => entry.id === itemId);
      if (!item) return;
      // 未実装: 将来のためにログのみ
      console.log('Duplicate item:', item);
    },
    [timeline],
  );

  return {
    editingDraft,
    openDraftFromItemId,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
    handleContextMenuJumpTo,
    handleContextMenuDuplicate,
  };
};
