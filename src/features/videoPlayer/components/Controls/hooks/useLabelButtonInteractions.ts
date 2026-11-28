import { useCallback } from 'react';
import type { CodeWindowButton } from '../../../../../types/settings/coreTypes';
import type { EffectiveLink } from '../effectiveLinks';
import { findRelatedLinks, resolveLinkEffects } from './codePanelLinkRules';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';
import { planLinkedLabelOperation } from '../domain/linkedLabelOperation';

interface LinkedActions {
  getActiveRecordingKeyById: (id: string) => string | undefined;
  startLinkedAction: (id: string) => void;
}

interface UseLabelButtonInteractionsParams {
  activeMode: 'code' | 'label';
  linkedActions?: LinkedActions;
  hasSelectedTimelineItems: boolean;
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
  linkedActions,
  hasSelectedTimelineItems,
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

      if (activeMode === 'label') {
        if (hasSelectedTimelineItems)
          handleApplyLabel(labelButtonName, labelValue);
        else setWarning('タイムラインのアクションを選択してください');
        return;
      }

      if (button.labelTargetMode === 'linked' && linkedActions) {
        const { labelNames, stopNames, startIds } = planLinkedLabelOperation(
          effectiveLinks,
          button.id,
          linkedActions.getActiveRecordingKeyById,
        );
        if (labelNames.length === 0) {
          setWarning('このラベルのリンク先で記録中のコードがありません');
          return;
        }
        updateLabelSelections((prev) => {
          const next = { ...prev };
          for (const name of labelNames)
            next[name] = { ...next[name], [labelButtonName]: labelValue };
          return next;
        });
        for (const name of stopNames)
          completeRecording(name, { [labelButtonName]: labelValue });
        for (const id of startIds) linkedActions.startLinkedAction(id);
        setWarning(null);
        return;
      }

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
        button.id,
      );

      const toDeactivate: string[] = [];
      for (const targetName of effects.deactivateTargets) {
        const targetKey = resolveRecordingKey(targetName);
        if (!targetKey) continue;
        toDeactivate.push(targetKey);
        break;
      }

      const alreadyRecording = Object.keys(activeRecordingsRef.current);
      for (const targetActionName of effects.activateTargets) {
        const time = getCurrentTime();
        if (time === null) break;
        const targetColors: Record<string, string | undefined> = {};
        setActiveRecordings((prev) => ({
          ...prev,
          [targetActionName]: {
            teamName: teamNames[0] || 'Team',
            startTime: time,
            leadTimeSeconds: 0,
            lagTimeSeconds: 0,
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
        break;
      }

      const targetActions = new Set<string>([
        ...alreadyRecording,
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

      setWarning(null);
    },
    [
      activeMode,
      activeRecordingsRef,
      completeRecording,
      effectiveLinks,
      getButtonColorByName,
      getCurrentTime,
      handleApplyLabel,
      hasSelectedTimelineItems,
      isSameActionName,
      linkedActions,
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
