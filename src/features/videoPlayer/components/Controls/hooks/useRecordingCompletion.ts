import { useCallback } from 'react';
import { resolveRecordingRange } from '../domain/recordingRange';
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

export type CompleteRecording = (
  actionName: string,
  labelsPatch?: Record<string, string>,
  endOverride?: number,
) => void;

interface UseRecordingCompletionParams {
  activeRecordingsRef: React.RefObject<Record<string, ActiveRecordingSession>>;
  getCodingDuration: () => number | null;
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
  activeRecordingsRef,
  getCodingDuration,
  getCurrentTime,
  labelSelectionsRef,
  updateLabelSelections,
  setPrimaryAction,
  recentActionsRef,
  setActiveRecordings,
}: UseRecordingCompletionParams): CompleteRecording => {
  return useCallback(
    (
      actionName: string,
      labelsPatch?: Record<string, string>,
      endOverride?: number,
    ) => {
      const prev = activeRecordingsRef.current;
      const session = prev[actionName];
      if (!session) return;

      const endTime = endOverride ?? getCurrentTime();
      if (endTime === null) return;
      // Claim the session before publishing it. A repeat click or React's
      // StrictMode effects cannot publish the same session a second time.
      const next = { ...prev };
      delete next[actionName];
      setActiveRecordings(next);

      const range = resolveRecordingRange({
        startTime: session.startTime,
        endTime: session.automatic
          ? Math.max(
              session.startTime,
              Math.min(endTime, session.automatic.deadline),
            )
          : endTime,
        leadTimeSeconds: session.leadTimeSeconds,
        lagTimeSeconds: session.automatic ? 0 : session.lagTimeSeconds,
        maxTime: session.automatic
          ? (getCodingDuration() ?? undefined)
          : undefined,
      });

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
        range.startTime,
        range.endTime,
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
          range.startTime,
          range.endTime,
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
    },
    [
      activeRecordingsRef,
      addTimelineData,
      getCodingDuration,
      getCurrentTime,
      labelSelectionsRef,
      recentActionsRef,
      setActiveRecordings,
      setPrimaryAction,
      updateLabelSelections,
    ],
  );
};
