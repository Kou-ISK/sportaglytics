import { useMemo } from 'react';
import type { TimelineEditDraft } from '../TimelineEditDialog';

interface ValidationResult {
  startError?: string;
  endError?: string;
  isValid: boolean;
}

export const useTimelineValidation = (
  draft: TimelineEditDraft | null,
): ValidationResult => {
  return useMemo(() => {
    if (!draft) return { isValid: false };

    const parsedStart = Number(draft.startTime);
    const parsedEnd = Number(draft.endTime);

    let startError: string | undefined;
    let endError: string | undefined;

    if (!Number.isFinite(parsedStart)) {
      startError = '数値を入力してください';
    } else if (parsedStart < 0) {
      startError = '0以上の値を入力してください';
    }

    if (!Number.isFinite(parsedEnd)) {
      endError = '数値を入力してください';
    } else if (parsedEnd < 0) {
      endError = '0以上の値を入力してください';
    }

    if (!startError && !endError && parsedEnd < parsedStart) {
      endError = '終了は開始以上にしてください';
    }

    return {
      startError,
      endError,
      isValid: !startError && !endError,
    };
  }, [draft]);
};
