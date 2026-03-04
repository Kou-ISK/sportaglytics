import { useCallback } from 'react';
import type { ActionDefinition } from '../../../../../types/Settings';
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
  completeRecording: (actionName: string, labelsPatch?: Record<string, string>) => void;
  recentActionsRef: React.MutableRefObject<string[]>;
  getButtonColorByName: (buttonName: string) => string | undefined;
}

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
    ) => {
      if (activeMode === 'label') {
        return;
      }

      const clickedButtonName = originalButtonName || action.action;
      setPrimaryAction(clickedButtonName);

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
      );

      effects.exclusiveTargets.forEach((targetName) => {
        const targetKey = resolveRecordingKey(targetName);
        if (!targetKey) return;
        setWarning(`排他リンク: ${targetName} を終了します`);
        completeRecording(targetKey);
      });
      effects.deactivateTargets.forEach((targetName) => {
        const targetKey = resolveRecordingKey(targetName);
        if (!targetKey) return;
        setWarning(`非活性化: ${targetName} を終了します`);
        completeRecording(targetKey);
      });

      const activeKey = resolveRecordingKey(clickedButtonName);
      if (activeKey) {
        completeRecording(activeKey);
        return;
      }

      const time = getCurrentTime();
      if (time === null) return;

      const targetColors: Record<string, string | undefined> = {};
      effects.activateTargets.forEach((targetName) => {
        targetColors[targetName] = getButtonColorByName(targetName);
      });

      setActiveRecordings((prev) => ({
        ...prev,
        [clickedButtonName]: {
          teamName,
          startTime: time,
          color: buttonColor,
          activateTargets: effects.activateTargets,
          activateTargetColors: targetColors,
        },
      }));
      updateLabelSelections((prev) => ({
        ...prev,
        [clickedButtonName]: prev[clickedButtonName] ?? {},
      }));

      if (effects.activateTargets.length > 0) {
        setWarning(`活性化リンク: ${effects.activateTargets.join(', ')} も記録します`);
      } else {
        setWarning(null);
      }
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
