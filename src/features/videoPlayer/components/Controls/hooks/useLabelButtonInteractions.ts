import { useCallback } from 'react';
import type { CodeWindowButton } from '../../../../../types/settings/coreTypes';
import type { EffectiveLink } from '../effectiveLinks';
import { findRelatedLinks, resolveLinkEffects } from './codePanelLinkRules';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';

interface UseLabelButtonInteractionsParams {
  activeMode: 'code' | 'label';
  teamNames: string[];
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
  activeRecordingsRef: React.MutableRefObject<
    Record<string, ActiveRecordingSession>
  >;
  setActiveLabelButtons: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  getButtonColorByName: (buttonName: string) => string | undefined;
  handleApplyLabel: (groupName: string, option: string) => void;
}

export const useLabelButtonInteractions = ({
  activeMode,
  teamNames,
  effectiveLinks,
  isSameActionName,
  resolveRecordingKey,
  getCurrentTime,
  setActiveRecordings,
  updateLabelSelections,
  setPrimaryAction,
  setWarning,
  completeRecording,
  activeRecordingsRef,
  setActiveLabelButtons,
  getButtonColorByName,
  handleApplyLabel,
}: UseLabelButtonInteractionsParams) => {
  const handleLabelButtonClick = useCallback(
    (button: CodeWindowButton, labelButtonName: string, labelValue: string) => {
      setActiveLabelButtons((prev) => ({ ...prev, [button.id]: true }));
      setTimeout(() => {
        setActiveLabelButtons((prev) => ({ ...prev, [button.id]: false }));
      }, 1000);

      const relatedLinks = findRelatedLinks(
        effectiveLinks,
        labelButtonName,
        isSameActionName,
        button.id,
      );
      const effects = resolveLinkEffects(
        relatedLinks,
        labelButtonName,
        isSameActionName,
      );

      const toDeactivate: string[] = [];
      for (const targetName of effects.deactivateTargets) {
        const targetKey = resolveRecordingKey(targetName);
        if (!targetKey) continue;
        setWarning(`非活性化: ${targetName} を終了します`);
        toDeactivate.push(targetKey);
        break;
      }

      const newlyStarted: string[] = [];
      for (const targetActionName of effects.activateTargets) {
        const time = getCurrentTime();
        if (time === null) break;
        const targetColors: Record<string, string | undefined> = {};
        setActiveRecordings((prev) => ({
          ...prev,
          [targetActionName]: {
            teamName: teamNames[0] || 'Team',
            startTime: time,
            color: getButtonColorByName(targetActionName) ?? button.color,
            activateTargets: [],
            activateTargetColors: targetColors,
          },
        }));
        updateLabelSelections((prev) => ({
          ...prev,
          [targetActionName]: prev[targetActionName] ?? {},
        }));
        setPrimaryAction(targetActionName);
        setWarning(`活性化リンク: ${targetActionName} の記録を開始しました`);
        newlyStarted.push(targetActionName);
        break;
      }

      const targetActions = new Set<string>([
        ...Object.keys(activeRecordingsRef.current),
        ...toDeactivate,
      ]);
      if (targetActions.size > 0) {
        updateLabelSelections((prev) => {
          const next = { ...prev };
          targetActions.forEach((actionName) => {
            const current = next[actionName] ?? {};
            next[actionName] = {
              ...current,
              [labelButtonName]: labelValue,
            };
          });
          return next;
        });
      }

      toDeactivate.forEach((actionName) =>
        completeRecording(actionName, { [labelButtonName]: labelValue }),
      );

      if (activeMode === 'label') {
        handleApplyLabel(button.name, labelValue);
      }
      if (newlyStarted.length === 0) {
        setWarning(null);
      }
    },
    [
      activeMode,
      activeRecordingsRef,
      completeRecording,
      effectiveLinks,
      getButtonColorByName,
      getCurrentTime,
      handleApplyLabel,
      isSameActionName,
      resolveRecordingKey,
      setActiveLabelButtons,
      setActiveRecordings,
      setPrimaryAction,
      setWarning,
      teamNames,
      updateLabelSelections,
    ],
  );

  return {
    handleLabelButtonClick,
  };
};
