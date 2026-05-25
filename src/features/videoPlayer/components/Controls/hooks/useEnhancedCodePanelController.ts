import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActionPreset } from '../../../../../contexts/ActionPresetContext';
import type {
  ActionDefinition,
  CodeWindowLayout,
} from '../../../../../types/settings/coreTypes';
import { useSettings } from '../../../../../hooks/useSettings';
import {
  replaceTeamPlaceholders,
  type TeamContext,
} from '../../../../../utils/teamPlaceholder';
import { buildEffectiveLinks } from '../effectiveLinks';
import { useLabelSelections } from './useLabelSelections';
import { useActiveRecordings } from './useActiveRecordings';
import { useRecordingCompletion } from './useRecordingCompletion';
import { useCodePanelSettings } from './useCodePanelSettings';
import { useCodePanelInteractions } from './useCodePanelInteractions';
import type { EnhancedCodePanelProps } from '../EnhancedCodePanel.types';
import type { EnhancedCodePanelViewProps } from '../EnhancedCodePanelView';
import { getVideoJsPlayerCurrentTime } from '../../../shared/videojs/videoJsAdapter';
import {
  setLabelModeChecked,
  subscribeLabelModeToggle,
} from '../gateways/labelModeGateway';

interface UseEnhancedCodePanelControllerResult {
  triggerAction: (teamName: string, actionName: string) => void;
  viewProps: EnhancedCodePanelViewProps;
}

export const useEnhancedCodePanelController = ({
  addTimelineData,
  teamNames,
  firstTeamName,
  selectedIds = [],
  onApplyLabels,
}: EnhancedCodePanelProps): UseEnhancedCodePanelControllerResult => {
  const { activeActions } = useActionPreset();
  const { settings } = useSettings();

  const teamContext: TeamContext = useMemo(
    () => ({
      team1Name: teamNames[0] || 'Team1',
      team2Name: teamNames[1] || 'Team2',
    }),
    [teamNames],
  );

  const customLayout = useMemo((): CodeWindowLayout | null => {
    if (
      !settings.codingPanel?.codeWindows ||
      !settings.codingPanel?.activeCodeWindowId
    ) {
      return null;
    }
    return (
      settings.codingPanel.codeWindows.find(
        (layout) => layout.id === settings.codingPanel?.activeCodeWindowId,
      ) || null
    );
  }, [
    settings.codingPanel?.codeWindows,
    settings.codingPanel?.activeCodeWindowId,
  ]);

  const {
    activeRecordings,
    setActiveRecordings,
    activeRecordingsRef,
    primaryAction,
    setPrimaryAction,
    isSameActionName,
    resolveRecordingKey,
    isRecording,
  } = useActiveRecordings(teamNames);

  const { labelSelections, labelSelectionsRef, updateLabelSelections } =
    useLabelSelections();
  const { activeMode, setActiveMode, actionLinks } = useCodePanelSettings(
    settings.codingPanel,
  );
  const setWarning = useCallback((message: string | null) => {
    void message;
  }, []);
  const recentActionsRef = useRef<string[]>([]);
  const [activeLabelButtons, setActiveLabelButtons] = useState<
    Record<string, boolean>
  >({});
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (checked: boolean) => {
      setActiveMode(checked ? 'label' : 'code');
    };
    return subscribeLabelModeToggle(handler);
  }, [setActiveMode]);

  useEffect(() => {
    void setLabelModeChecked(activeMode === 'label');
  }, [activeMode]);

  const getCurrentTime = useCallback((): number | null => {
    return getVideoJsPlayerCurrentTime('video_0');
  }, []);

  const completeRecording = useRecordingCompletion({
    addTimelineData,
    getCurrentTime,
    labelSelectionsRef,
    updateLabelSelections,
    setPrimaryAction,
    recentActionsRef,
    setActiveRecordings,
  });

  const effectiveLinks = useMemo(
    () => buildEffectiveLinks(actionLinks, customLayout, teamContext),
    [actionLinks, customLayout, teamContext],
  );

  const {
    handleActionClick,
    handleLabelSelect,
    handleCustomButtonClick,
    getActionLabels,
  } = useCodePanelInteractions({
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
  });

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

  const triggerAction = useCallback(
    (teamName: string, actionName: string) => {
      const matchingTeam = teamNames.find((team) =>
        actionName.startsWith(`${team} `),
      );
      const baseActionName =
        matchingTeam && actionName.startsWith(`${matchingTeam} `)
          ? actionName.slice(matchingTeam.length + 1)
          : actionName;
      const action =
        activeActions.find((entry) => entry.action === baseActionName) ??
        ({
          action: baseActionName,
          types: [],
          results: [],
          groups: [],
        } as ActionDefinition);

      handleActionClick(
        matchingTeam ?? teamName,
        action,
        actionName,
        getButtonColorByName(actionName),
      );
    },
    [activeActions, getButtonColorByName, handleActionClick, teamNames],
  );

  return {
    triggerAction,
    viewProps: {
      activeMode,
      customLayout,
      teamContext,
      activeRecordings,
      primaryAction,
      activeLabelButtons,
      isRecording,
      layoutContainerRef,
      teamNames,
      firstTeamName,
      activeActions,
      getActionLabels,
      labelSelections,
      handleLabelSelect,
      handleCustomButtonClick,
      handleActionClick,
    },
  };
};
