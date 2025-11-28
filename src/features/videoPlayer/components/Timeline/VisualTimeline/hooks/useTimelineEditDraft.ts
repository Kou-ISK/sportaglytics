import { useCallback, useMemo } from 'react';
import type { TimelineEditDraft } from '../TimelineEditDialog';

interface UseTimelineEditDraftParams {
  draft: TimelineEditDraft | null;
  onChange: (changes: Partial<TimelineEditDraft>) => void;
}

export const useTimelineEditDraft = ({
  draft,
  onChange,
}: UseTimelineEditDraftParams) => {
  const updateTimes = useCallback(
    (start: string, end: string) => {
      onChange({ startTime: start, endTime: end });
    },
    [onChange],
  );

  const safeStartTime = useMemo(() => draft?.startTime ?? '', [draft]);
  const safeEndTime = useMemo(() => draft?.endTime ?? '', [draft]);
  const qualifier = useMemo(() => draft?.qualifier ?? '', [draft]);

  const setStartTime = useCallback(
    (value: string) => {
      onChange({ startTime: value || '' });
    },
    [onChange],
  );

  const setEndTime = useCallback(
    (value: string) => {
      onChange({ endTime: value || '' });
    },
    [onChange],
  );

  const setQualifier = useCallback(
    (value: string) => {
      onChange({ qualifier: value });
    },
    [onChange],
  );

  return {
    safeStartTime,
    safeEndTime,
    qualifier,
    setStartTime,
    setEndTime,
    setQualifier,
    updateTimes,
  };
};
