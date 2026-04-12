import { useCallback } from 'react';
import type {
  ActionDefinition,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import {
  replaceTeamPlaceholders,
  type TeamContext,
} from '../../../../../utils/teamPlaceholder';
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
          replaceTeamPlaceholders(entry.name, teamContext) === buttonName,
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

  const { handleLabelButtonClick } = useLabelButtonInteractions({
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

  const getActionLabels = useCallback((action: ActionDefinition) => {
    if (action.groups && action.groups.length > 0) {
      return action.groups;
    }

    const legacyGroups = [];
    if (action.types.length > 0) {
      legacyGroups.push({ groupName: 'actionType', options: action.types });
    }
    if (action.results.length > 0) {
      legacyGroups.push({
        groupName: 'actionResult',
        options: action.results,
      });
    }
    return legacyGroups;
  }, []);

  const handleCustomButtonClick = useCallback(
    (button: CodeWindowButton) => {
      if (button.type === 'action') {
        const buttonName = replaceTeamPlaceholders(button.name, teamContext);
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
        );
        return;
      }

      if (button.type === 'label' && button.labelValue) {
        const labelButtonName = replaceTeamPlaceholders(
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
