import { useCallback } from 'react';
import type {
  ActionDefinition,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/settings/coreTypes';
import {
  containsUnresolvedTeamPlaceholder,
  replaceTeamPlaceholderAliases,
  type TeamContext,
} from '../../../../../utils/teamPlaceholder';
import { resolveActionLabelGroups } from '../../../shared/actionLabelGroups';
import type { EffectiveLink } from '../effectiveLinks';
import { useActionButtonInteractions } from './useActionButtonInteractions';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';
import { useLabelButtonInteractions } from './useLabelButtonInteractions';

type UseCodePanelInteractionsParams = {
  activeMode: 'code' | 'label';
  activeActions: ActionDefinition[];
  teamNames: string[];
  teamContext: TeamContext;
  selectedIds: string[];
  onApplyLabels?: (
    ids: string[],
    labels: { name: string; group: string }[],
  ) => void;
  customLayout: CodeWindowLayout | null;
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
  activeRecordingsRef: React.MutableRefObject<
    Record<string, ActiveRecordingSession>
  >;
  setActiveLabelButtons: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
};

export const useCodePanelInteractions = ({
  activeMode,
  activeActions,
  teamNames,
  teamContext,
  selectedIds,
  onApplyLabels,
  customLayout,
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
  activeRecordingsRef,
  setActiveLabelButtons,
}: UseCodePanelInteractionsParams) => {
  const getButtonColorByName = useCallback(
    (buttonName: string): string | undefined => {
      if (!customLayout) return undefined;
      const button = customLayout.buttons.find(
        (entry) =>
          replaceTeamPlaceholderAliases(entry.name, teamContext) === buttonName,
      );
      return button?.color;
    },
    [customLayout, teamContext],
  );

  const handleApplyLabel = useCallback(
    (groupName: string, option: string) => {
      if (!onApplyLabels || selectedIds.length === 0) {
        setWarning('タイムラインのアクションを選択してください');
        return;
      }
      onApplyLabels(selectedIds, [{ group: groupName, name: option }]);
      setWarning(null);
    },
    [onApplyLabels, selectedIds, setWarning],
  );

  const { handleActionClick } = useActionButtonInteractions({
    activeRecordingsRef,
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
  });

  const getActionButtonById = useCallback(
    (id: string) => {
      const button = customLayout?.buttons.find(
        (entry) => entry.id === id && entry.type === 'action',
      );
      if (!button || !customLayout) return undefined;
      const name = replaceTeamPlaceholderAliases(button.name, teamContext);
      if (containsUnresolvedTeamPlaceholder(name)) return undefined;
      // The current timeline runtime keys recordings by name. Do not guess if
      // two buttons in the layout resolve to the same row.
      const matches = customLayout.buttons.filter(
        (entry) =>
          entry.type === 'action' &&
          replaceTeamPlaceholderAliases(entry.name, teamContext) === name,
      );
      return matches.length === 1 ? { button, name } : undefined;
    },
    [customLayout, teamContext],
  );

  const startLinkedAction = useCallback(
    (id: string) => {
      const target = getActionButtonById(id);
      if (!target || activeRecordingsRef.current[target.name]) return;
      const { button, name } = target;
      const teamName =
        teamNames.find((team) => name.startsWith(`${team} `)) ??
        teamNames[0] ??
        'Team';
      handleActionClick(
        teamName,
        { action: name, types: [], results: [] },
        name,
        button.color,
        button.id,
        button.leadTimeSeconds,
        button.lagTimeSeconds,
        button.recordingMode,
        button.extendOnRepeat,
        true,
      );
    },
    [activeRecordingsRef, getActionButtonById, handleActionClick, teamNames],
  );

  const getExactActionNameById = useCallback(
    (id: string) => getActionButtonById(id)?.name,
    [getActionButtonById],
  );

  const { handleLabelButtonClick } = useLabelButtonInteractions({
    linkedActions: { getExactActionNameById, startLinkedAction },
    activeMode,
    hasSelectedTimelineItems: selectedIds.length > 0,
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
  });

  const handleLabelSelect = useCallback(
    (actionName: string, groupName: string, option: string) => {
      if (activeMode === 'label') {
        handleApplyLabel(groupName, option);
        return;
      }

      updateLabelSelections((prev) => {
        const current = prev[actionName] ?? {};
        return {
          ...prev,
          [actionName]: {
            ...current,
            [groupName]: option,
          },
        };
      });
      setPrimaryAction(actionName);
    },
    [activeMode, handleApplyLabel, setPrimaryAction, updateLabelSelections],
  );

  const getActionLabels = useCallback(
    (action: ActionDefinition) => resolveActionLabelGroups(action),
    [],
  );

  const handleCustomButtonClick = useCallback(
    (button: CodeWindowButton) => {
      if (button.type === 'action') {
        const buttonName = replaceTeamPlaceholderAliases(
          button.name,
          teamContext,
        );
        if (containsUnresolvedTeamPlaceholder(buttonName)) {
          setWarning(null);
          return;
        }
        const matchedTeam = teamNames.find((team) =>
          buttonName.startsWith(`${team} `),
        );
        let teamName: string;
        let actionName: string;

        if (matchedTeam) {
          teamName = matchedTeam;
          actionName = buttonName.slice(matchedTeam.length + 1);
        } else {
          teamName = teamNames[0] || 'Team';
          actionName = buttonName;
        }

        const action = activeActions.find(
          (entry) => entry.action === actionName,
        );
        const effectiveAction: ActionDefinition =
          action ||
          ({
            action: actionName,
            types: [],
            results: [],
            groups: [],
          } as ActionDefinition);

        handleActionClick(
          teamName,
          effectiveAction,
          buttonName,
          button.color,
          button.id,
          button.leadTimeSeconds,
          button.lagTimeSeconds,
          button.recordingMode,
          button.extendOnRepeat,
        );
        return;
      }

      if (button.type === 'label' && button.labelValue) {
        const labelButtonName = replaceTeamPlaceholderAliases(
          button.name,
          teamContext,
        );
        handleLabelButtonClick(button, labelButtonName, button.labelValue);
      }
    },
    [
      activeActions,
      handleActionClick,
      handleLabelButtonClick,
      teamContext,
      teamNames,
    ],
  );

  return {
    handleActionClick,
    handleLabelSelect,
    handleCustomButtonClick,
    getActionLabels,
  };
};
