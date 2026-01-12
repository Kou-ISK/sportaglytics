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
  onUpdateMemo?: (id: string, memo: string) => void;
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
  const memo = draft?.memo ?? '';

  const setStartTime = (value: string) => onChange({ startTime: value });
  const setEndTime = (value: string) => onChange({ endTime: value });
  const setMemo = (value: string) => onChange({ memo: value });

  return {
    safeStartTime,
    safeEndTime,
    memo,
    setStartTime,
    setEndTime,
    setMemo,
  };
};

export const useTimelineEditActions = ({
  timeline,
  onDelete,
  onSeek,
  onUpdateTimelineItem,
  onUpdateMemo,
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
        memo: item.memo || '',
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
        memo: editingDraft.memo,
        labels: editingDraft.labels,
        startTime: safeStart,
        endTime: safeEnd,
      });
    } else {
      if (onUpdateMemo) {
        onUpdateMemo(editingDraft.id, editingDraft.memo);
      }
      if (onUpdateTimeRange) {
        onUpdateTimeRange(editingDraft.id, safeStart, safeEnd);
      }
    }

    setEditingDraft(null);
  }, [editingDraft, onUpdateMemo, onUpdateTimeRange, onUpdateTimelineItem]);

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
