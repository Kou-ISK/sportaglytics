import { useCallback } from 'react';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';

type AddTimelineData = (
  actionName: string,
  startTime: number,
  endTime: number,
  memo: string,
  actionType?: string,
  actionResult?: string,
  labels?: Array<{ name: string; group: string }>,
  color?: string,
) => void;

interface UseRecordingCompletionParams {
  addTimelineData: AddTimelineData;
  getCurrentTime: () => number | null;
  labelSelectionsRef: React.MutableRefObject<LabelSelectionsMap>;
  updateLabelSelections: (
    updater:
      | LabelSelectionsMap
      | ((prev: LabelSelectionsMap) => LabelSelectionsMap),
  ) => void;
  setPrimaryAction: React.Dispatch<React.SetStateAction<string | null>>;
  recentActionsRef: React.MutableRefObject<string[]>;
  setActiveRecordings: React.Dispatch<
    React.SetStateAction<Record<string, ActiveRecordingSession>>
  >;
}

export const useRecordingCompletion = ({
  addTimelineData,
  getCurrentTime,
  labelSelectionsRef,
  updateLabelSelections,
  setPrimaryAction,
  recentActionsRef,
  setActiveRecordings,
}: UseRecordingCompletionParams) => {
  return useCallback(
    (actionName: string, labelsPatch?: Record<string, string>) => {
      setActiveRecordings((prev) => {
        const session = prev[actionName];
        if (!session) return prev;

        const endTime = getCurrentTime();
        if (endTime === null) return prev;

        const [begin, end] =
          endTime >= session.startTime
            ? [session.startTime, endTime]
            : [endTime, session.startTime];

        const labelsMap = {
          ...(labelSelectionsRef.current[actionName] ?? {}),
          ...(labelsPatch ?? {}),
        };
        const labels = Object.entries(labelsMap).map(([group, name]) => ({
          name,
          group,
        }));

        // メインアクションをタイムラインに追加（色付き）
        addTimelineData(
          actionName,
          begin,
          end,
          '',
          undefined,
          undefined,
          labels.length > 0 ? labels : undefined,
          session.color,
        );

        // Activateリンクのターゲットも同じ時間範囲で追加（ターゲットの色付き）
        session.activateTargets.forEach((targetName) => {
          addTimelineData(
            targetName,
            begin,
            end,
            '',
            undefined,
            undefined,
            undefined,
            session.activateTargetColors[targetName],
          );
        });

        updateLabelSelections((prevLabels) => {
          const nextLabels = { ...prevLabels };
          delete nextLabels[actionName];
          return nextLabels;
        });
        setPrimaryAction((prevPrimary) =>
          prevPrimary === actionName ? null : prevPrimary,
        );
        recentActionsRef.current = recentActionsRef.current.filter(
          (name) => name !== actionName,
        );

        const next = { ...prev };
        delete next[actionName];
        return next;
      });
    },
    [
      addTimelineData,
      getCurrentTime,
      labelSelectionsRef,
      recentActionsRef,
      setActiveRecordings,
      setPrimaryAction,
      updateLabelSelections,
    ],
  );
};
