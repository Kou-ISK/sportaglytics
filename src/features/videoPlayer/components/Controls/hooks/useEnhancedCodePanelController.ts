import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActionPreset } from '../../../../../contexts/ActionPresetContext';
import type {
  CodingPanelWindowCommand,
  CodingPanelWindowSyncPayload,
} from '../../../../../types/ipc/codingPanelWindow';
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
import {
  openCodingPanelWindow,
  subscribeCodingPanelWindowCommand,
  syncCodingPanelWindow,
} from '../gateways/codingPanelWindowGateway';
import {
  consumeRuntimeCodeWindowExternalOpen,
  chooseRuntimeCodeWindowFile,
  loadRuntimeCodeWindowFile,
  saveRuntimeCodeWindowFile,
  subscribeRuntimeCodeWindowExternalOpen,
  subscribeRuntimeCodeWindowMenuOpen,
} from '../gateways/codeWindowRuntimeFileGateway';

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
  windowHotkeys = [],
  onHotkeyKeyDown,
  onHotkeyKeyUp,
  onActiveLayoutChange,
}: EnhancedCodePanelProps): UseEnhancedCodePanelControllerResult => {
  const { activeActions } = useActionPreset();
  const { settings } = useSettings();
  const [sessionLayout, setSessionLayout] = useState<CodeWindowLayout | null>(
    null,
  );
  const [sessionFilePath, setSessionFilePath] = useState<string | null>(null);

  const teamContext: TeamContext = useMemo(
    () => ({
      team1Name: teamNames[0] || 'Team1',
      team2Name: teamNames[1] || 'Team2',
    }),
    [teamNames],
  );

  const settingsLayout = useMemo((): CodeWindowLayout | null => {
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
  const customLayout = sessionLayout ?? settingsLayout;

  useEffect(() => {
    onActiveLayoutChange?.(customLayout);
  }, [customLayout, onActiveLayoutChange]);

  const openRuntimeCodeWindowFile = useCallback(async (filePath: string) => {
    const file = await loadRuntimeCodeWindowFile(filePath);
    if (!file) return;
    setSessionLayout(file.layout);
    setSessionFilePath(file.filePath);
    await consumeRuntimeCodeWindowExternalOpen(filePath);
    await openCodingPanelWindow();
  }, []);

  const chooseRuntimeCodeWindow = useCallback(async () => {
    const file = await chooseRuntimeCodeWindowFile();
    if (!file) return;
    setSessionLayout(file.layout);
    setSessionFilePath(file.filePath);
    await openCodingPanelWindow();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRuntimeCodeWindowExternalOpen((filePath) => {
      void openRuntimeCodeWindowFile(filePath);
    });

    const consumePending = async (): Promise<void> => {
      const pendingPath = await consumeRuntimeCodeWindowExternalOpen();
      if (pendingPath) {
        await openRuntimeCodeWindowFile(pendingPath);
      }
    };
    void consumePending();

    return unsubscribe;
  }, [openRuntimeCodeWindowFile]);

  useEffect(() => {
    return subscribeRuntimeCodeWindowMenuOpen(() => {
      void chooseRuntimeCodeWindow();
    });
  }, [chooseRuntimeCodeWindow]);

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

  const codingPanelWindowPayload = useMemo(
    (): CodingPanelWindowSyncPayload => ({
      activeMode,
      customLayout,
      teamNames,
      firstTeamName,
      activeActions,
      activeRecordings,
      primaryAction,
      activeLabelButtons,
      isRecording,
      labelSelections,
      hotkeys: windowHotkeys,
      codeWindowFilePath: sessionFilePath ?? undefined,
    }),
    [
      activeActions,
      activeLabelButtons,
      activeMode,
      activeRecordings,
      customLayout,
      firstTeamName,
      isRecording,
      labelSelections,
      primaryAction,
      sessionFilePath,
      teamNames,
      windowHotkeys,
    ],
  );

  useEffect(() => {
    syncCodingPanelWindow(codingPanelWindowPayload);
  }, [codingPanelWindowPayload]);

  const handleCodingPanelWindowCommand = useCallback(
    (command: CodingPanelWindowCommand): void => {
      if (command.type === 'request-sync') {
        syncCodingPanelWindow(codingPanelWindowPayload);
        return;
      }

      if (command.type === 'layout-updated') {
        setSessionLayout(command.layout);
        return;
      }

      if (command.type === 'save-layout') {
        setSessionLayout(command.layout);
        void saveRuntimeCodeWindowFile(
          command.layout,
          command.saveAs ? undefined : (sessionFilePath ?? undefined),
        ).then((savedPath) => {
          if (savedPath) {
            setSessionFilePath(savedPath);
          }
        });
        return;
      }

      if (command.type === 'hotkey-key-down') {
        onHotkeyKeyDown?.(command.hotkeyId);
        return;
      }

      if (command.type === 'hotkey-key-up') {
        onHotkeyKeyUp?.(command.hotkeyId);
        return;
      }

      if (command.type === 'custom-button-click') {
        const button = customLayout?.buttons.find(
          (entry) => entry.id === command.buttonId,
        );
        if (button) {
          handleCustomButtonClick(button);
        }
        return;
      }

      if (command.type === 'action-click') {
        const action =
          activeActions.find((entry) => entry.action === command.actionName) ??
          ({
            action: command.actionName,
            types: [],
            results: [],
            groups: [],
          } as ActionDefinition);
        handleActionClick(command.teamName, action);
        return;
      }

      handleLabelSelect(command.actionName, command.groupName, command.option);
    },
    [
      activeActions,
      codingPanelWindowPayload,
      customLayout?.buttons,
      handleActionClick,
      handleCustomButtonClick,
      handleLabelSelect,
      onHotkeyKeyDown,
      onHotkeyKeyUp,
      sessionFilePath,
    ],
  );

  useEffect(() => {
    return subscribeCodingPanelWindowCommand(handleCodingPanelWindowCommand);
  }, [handleCodingPanelWindowCommand]);

  const handleOpenDetachedWindow = useCallback((): void => {
    void openCodingPanelWindow().then((opened) => {
      if (opened) {
        syncCodingPanelWindow(codingPanelWindowPayload);
      }
    });
  }, [codingPanelWindowPayload]);

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
      onOpenDetachedWindow: handleOpenDetachedWindow,
    },
  };
};
