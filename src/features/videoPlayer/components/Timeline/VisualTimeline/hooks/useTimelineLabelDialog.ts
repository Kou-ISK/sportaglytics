import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';

interface UseTimelineLabelDialogParams {
  timeline: TimelineData[];
  selectedIds: string[];
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  info: (message: string) => void;
}

export const useTimelineLabelDialog = ({
  timeline,
  selectedIds,
  onUpdateTimelineItem,
  info,
}: UseTimelineLabelDialogParams) => {
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelGroup, setLabelGroup] = useState('');
  const [labelName, setLabelName] = useState('');

  const timelineRef = useRef(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  const handleApplyLabel = useCallback(
    (override?: { group: string; name: string }) => {
      if (!onUpdateTimelineItem) return;
      const group = (override?.group ?? labelGroup).trim();
      const name = (override?.name ?? labelName).trim();
      if (!group || !name) return;

      let applied = 0;
      const uniqueIds = Array.from(new Set(selectedIds));
      const current = timelineRef.current;

      uniqueIds.forEach((id) => {
        const item = current.find((t) => t.id === id);
        if (!item) return;
        const existing = item.labels ? [...item.labels] : [];
        const exists = existing.some(
          (label) => label.group === group && label.name === name,
        );
        const updatedLabels = exists
          ? existing
          : [...existing, { group, name }];
        onUpdateTimelineItem(id, { labels: updatedLabels });
        applied += 1;
      });

      if (applied > 0) {
        info(`${applied}件にラベル '${group}: ${name}' を付与しました`);
      }
      setLabelGroup(group);
      setLabelName(name);
      setLabelDialogOpen(false);
    },
    [info, labelGroup, labelName, onUpdateTimelineItem, selectedIds],
  );

  return {
    labelDialogOpen,
    setLabelDialogOpen,
    labelGroup,
    setLabelGroup,
    labelName,
    setLabelName,
    handleApplyLabel,
  };
};
