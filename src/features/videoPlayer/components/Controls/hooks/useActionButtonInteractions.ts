import { useCallback } from 'react';
import type { ActionDefinition } from '../../../../../types/settings/coreTypes';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';
import { findRelatedLinks, resolveLinkEffects } from './codePanelLinkRules';
import type { EffectiveLink } from '../effectiveLinks';

interface UseActionButtonInteractionsParams {
  activeMode: 'code' | 'label';
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
  completeRecording: (
    actionName: string,
    labelsPatch?: Record<string, string>,
  ) => void;
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
}: UseActionButtonInteractionsParams) => {
  const handleActionClick = useCallback(
    (
      teamName: string,
      action: ActionDefinition,
      originalButtonName?: string,
      buttonColor?: string,
      buttonId?: string,
      leadTimeSeconds?: number,
      lagTimeSeconds?: number,
    ) => {
      if (activeMode === 'label') {
        return;
      }

      const clickedButtonName = originalButtonName || action.action;

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

      const activeKey = resolveRecordingKey(clickedButtonName);
      if (activeKey) {
        completeRecording(activeKey);
        return;
      }

      const time = getCurrentTime();
      if (time === null) return;
      setPrimaryAction(clickedButtonName);

      const targetColors: Record<string, string | undefined> = {};
      effects.activateTargets.forEach((targetName) => {
        targetColors[targetName] = getButtonColorByName(targetName);
      });

      setActiveRecordings((prev) => ({
        ...prev,
        [clickedButtonName]: {
          teamName,
          startTime: time,
          leadTimeSeconds: normalizePaddingSeconds(leadTimeSeconds),
          lagTimeSeconds: normalizePaddingSeconds(lagTimeSeconds),
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
