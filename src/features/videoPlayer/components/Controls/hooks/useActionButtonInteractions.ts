import { useCallback } from 'react';
import type { ActionDefinition } from '../../../../../types/settings/coreTypes';
import type { ActiveRecordingSession } from './useActiveRecordings';
import { repeatAutomaticRecording } from '../domain/automaticRecording';
import type { CompleteRecording } from './useRecordingCompletion';
import type { LabelSelectionsMap } from './useLabelSelections';
import { findRelatedLinks, resolveLinkEffects } from './codePanelLinkRules';
import type { EffectiveLink } from '../effectiveLinks';

interface UseActionButtonInteractionsParams {
  activeMode: 'code' | 'label';
  activeRecordingsRef: React.RefObject<Record<string, ActiveRecordingSession>>;
  effectiveLinks: EffectiveLink[];
  isSameActionName: (a: string, b: string) => boolean;
  resolveRecordingKey: (name: string) => string | undefined;
  getCurrentTime: () => number | null;
  setActiveRecordings: React.Dispatch<
    React.SetStateAction<Record<string, ActiveRecordingSession>>
  >;
  updateLabelSelections: (
    updater:
      | LabelSelectionsMap
      | ((prev: LabelSelectionsMap) => LabelSelectionsMap),
  ) => void;
  setPrimaryAction: React.Dispatch<React.SetStateAction<string | null>>;
  setWarning: (message: string | null) => void;
  completeRecording: CompleteRecording;
  recentActionsRef: React.MutableRefObject<string[]>;
  getButtonColorByName: (buttonName: string) => string | undefined;
}

const normalizePaddingSeconds = (value: number | undefined): number => {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
};

export const useActionButtonInteractions = ({
  activeMode,
  activeRecordingsRef,
  effectiveLinks,
  isSameActionName,
  resolveRecordingKey,
  getCurrentTime,
  setActiveRecordings,
  updateLabelSelections,
  setPrimaryAction,
  setWarning,
  completeRecording,
  recentActionsRef,
  getButtonColorByName,
}: UseActionButtonInteractionsParams): {
  handleActionClick: (
    teamName: string,
    action: ActionDefinition,
    originalButtonName?: string,
    buttonColor?: string,
    buttonId?: string,
    leadTimeSeconds?: number,
    lagTimeSeconds?: number,
    recordingMode?: 'single-click',
    extendOnRepeat?: boolean,
    explicitActivation?: true,
  ) => void;
} => {
  const handleActionClick = useCallback(
    (
      teamName: string,
      action: ActionDefinition,
      originalButtonName?: string,
      buttonColor?: string,
      buttonId?: string,
      leadTimeSeconds?: number,
      lagTimeSeconds?: number,
      recordingMode?: 'single-click',
      extendOnRepeat?: boolean,
      explicitActivation?: true,
    ) => {
      if (activeMode === 'label') {
        return;
      }

      const clickedButtonName = originalButtonName || action.action;

      // Link effects belong to the source button's activation edge only.
      const time = getCurrentTime();
      if (time === null) return;
      // A directed activation is not a user press and never stops or
      // extends a recording that is already active.
      if (explicitActivation && activeRecordingsRef.current[clickedButtonName])
        return;
      const activeKey = explicitActivation
        ? undefined
        : resolveRecordingKey(clickedButtonName);
      if (activeKey) {
        const active = activeRecordingsRef.current[activeKey];
        if (!active?.automatic) {
          completeRecording(activeKey);
          return;
        }
        const next = repeatAutomaticRecording(active, time);
        if (next) {
          if (next !== active)
            setActiveRecordings((prev) => ({ ...prev, [activeKey]: next }));
          return;
        }
        completeRecording(activeKey, undefined, active.automatic.deadline);
      }

      const relatedLinks = findRelatedLinks(
        effectiveLinks,
        clickedButtonName,
        isSameActionName,
        buttonId,
      );
      const effects = resolveLinkEffects(
        relatedLinks,
        clickedButtonName,
        isSameActionName,
        buttonId,
      );

      effects.exclusiveTargets.forEach((targetName) => {
        const targetKey = resolveRecordingKey(targetName);
        if (!targetKey) return;
        completeRecording(targetKey);
      });
      effects.deactivateTargets.forEach((targetName) => {
        const targetKey = resolveRecordingKey(targetName);
        if (!targetKey) return;
        completeRecording(targetKey);
      });

      setPrimaryAction(clickedButtonName);

      const targetColors: Record<string, string | undefined> = {};
      effects.activateTargets.forEach((targetName) => {
        targetColors[targetName] = getButtonColorByName(targetName);
      });

      const lag = normalizePaddingSeconds(lagTimeSeconds);
      setActiveRecordings((prev) => ({
        ...prev,
        [clickedButtonName]: {
          teamName,
          startTime: time,
          leadTimeSeconds: normalizePaddingSeconds(leadTimeSeconds),
          lagTimeSeconds: lag,
          automatic:
            recordingMode === 'single-click'
              ? {
                  deadline: time + lag,
                  duration: lag,
                  extendOnRepeat: extendOnRepeat === true,
                }
              : undefined,
          color: buttonColor,
          activateTargets: effects.activateTargets,
          activateTargetColors: targetColors,
        },
      }));
      updateLabelSelections((prev) => ({
        ...prev,
        [clickedButtonName]: prev[clickedButtonName] ?? {},
      }));

      setWarning(null);
      recentActionsRef.current = [
        ...recentActionsRef.current.slice(-10),
        action.action,
      ];
    },
    [
      activeMode,
      activeRecordingsRef,
      completeRecording,
      effectiveLinks,
      getButtonColorByName,
      getCurrentTime,
      isSameActionName,
      recentActionsRef,
      resolveRecordingKey,
      setActiveRecordings,
      setPrimaryAction,
      setWarning,
      updateLabelSelections,
    ],
  );

  return {
    handleActionClick,
  };
};
