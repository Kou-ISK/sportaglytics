import { useCodingPanelCommands } from './useCodingPanelCommands';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  replaceTeamPlaceholderAliases,
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
import { useCodingTime } from './useCodingTime';
import {
  openCodingPanelWindow,
  syncCodingPanelWindow,
} from '../gateways/codingPanelWindowGateway';
import {
  consumeRuntimeCodeWindowExternalOpen,
  chooseRuntimeCodeWindowFile,
  loadRuntimeCodeWindowFile,
  saveRuntimeCodeWindowFile,
  subscribeRuntimeCodeWindowExternalOpen,
  subscribeRuntimeCodeWindowMenuCreate,
  subscribeRuntimeCodeWindowMenuOpen,
} from '../gateways/codeWindowRuntimeFileGateway';
import {
  createEmptyCodeWindowLayout,
  getCodeWindowNameFromFilePath,
} from '../utils/createEmptyCodeWindowLayout';

interface UseEnhancedCodePanelControllerResult {
  triggerAction: (
    teamName: string,
    actionName: string,
    buttonId?: string,
  ) => void;
  viewProps: EnhancedCodePanelViewProps;
}

export const useEnhancedCodePanelController = ({
  codingTime,
  documentEditable = true,
  documentRevision = 0,
  addTimelineData,
  teamNames,
  firstTeamName,
  selectedIds = [],
  selectedTimelineLabels = [],
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
  const saveLayoutInFlightRef = useRef(false);

  const teamContext: TeamContext = useMemo(
    () => ({
      team1Name: teamNames[0] || '',
      team2Name: teamNames[1] || '',
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

  const createRuntimeCodeWindow = useCallback(async () => {
    const layout = createEmptyCodeWindowLayout();
    const savedPath = await saveRuntimeCodeWindowFile(layout);
    if (!savedPath) return;
    const namedLayout = {
      ...layout,
      name: getCodeWindowNameFromFilePath(savedPath),
    };
    await saveRuntimeCodeWindowFile(namedLayout, savedPath);
    setSessionLayout(namedLayout);
    setSessionFilePath(savedPath);
    await openCodingPanelWindow();
  }, []);

  useEffect(() => {
    return subscribeRuntimeCodeWindowMenuCreate(() => {
      void createRuntimeCodeWindow();
    });
  }, [createRuntimeCodeWindow]);

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const setWarning = useCallback((message: string | null): void => {
    setStatusMessage(message);
  }, []);
  const recentActionsRef = useRef<string[]>([]);
  const [activeLabelButtons, setActiveLabelButtons] = useState<
    Record<string, boolean>
  >({});
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);

  const getCurrentTime = useCodingTime(documentEditable ? codingTime : null);
  useLayoutEffect(() => {
    // Pending recordings and labels belong to the successfully loaded document.
    activeRecordingsRef.current = {};
    setActiveRecordings({});
    labelSelectionsRef.current = {};
    updateLabelSelections({});
    recentActionsRef.current = [];
    setActiveLabelButtons({});
    setPrimaryAction(null);
  }, [
    documentEditable,
    documentRevision,
    activeRecordingsRef,
    setActiveRecordings,
    labelSelectionsRef,
    updateLabelSelections,
    setPrimaryAction,
  ]);

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
      selectedTimelineLabels,
      statusMessage: documentEditable
        ? statusMessage
        : 'タイムラインの読み込みが完了するまでタグ付けを停止しています。',
      documentEditable,
      hotkeys: windowHotkeys,
      codeWindowFilePath: sessionFilePath ?? undefined,
    }),
    [
      activeActions,
      activeLabelButtons,
      activeMode,
      activeRecordings,
      customLayout,
      documentEditable,
      firstTeamName,
      isRecording,
      labelSelections,
      primaryAction,
      selectedTimelineLabels,
      sessionFilePath,
      statusMessage,
      teamNames,
      windowHotkeys,
    ],
  );

  useEffect(() => {
    syncCodingPanelWindow(codingPanelWindowPayload);
  }, [codingPanelWindowPayload]);

  const saveLayout = useCallback(
    async (
      command: Extract<CodingPanelWindowCommand, { type: 'save-layout' }>,
    ) => {
      if (saveLayoutInFlightRef.current) return;
      saveLayoutInFlightRef.current = true;
      setSessionLayout(command.layout);
      try {
        const savedPath = await saveRuntimeCodeWindowFile(
          command.layout,
          command.saveAs
            ? undefined
            : (command.filePath ?? sessionFilePath ?? undefined),
        );
        if (savedPath) {
          setSessionFilePath(savedPath);
        }
      } finally {
        saveLayoutInFlightRef.current = false;
      }
    },
    [sessionFilePath],
  );

  const handleCodingPanelWindowCommand = useCallback(
    (command: CodingPanelWindowCommand): void => {
      if (command.type === 'request-sync') {
        syncCodingPanelWindow(codingPanelWindowPayload);
        return;
      }

      if (command.type === 'set-mode') {
        setActiveMode(command.mode);
        return;
      }

      if (command.type === 'layout-updated') {
        setSessionLayout(command.layout);
        return;
      }

      if (command.type === 'save-layout') {
        void saveLayout(command);
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

      if (!documentEditable) return;

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
      documentEditable,
      handleActionClick,
      handleCustomButtonClick,
      handleLabelSelect,
      onHotkeyKeyDown,
      onHotkeyKeyUp,
      saveLayout,
      setActiveMode,
    ],
  );

  useCodingPanelCommands(handleCodingPanelWindowCommand);

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
          replaceTeamPlaceholderAliases(entry.name, teamContext) === buttonName,
      );
      return button?.color;
    },
    [customLayout, teamContext],
  );

  const triggerAction = useCallback(
    (teamName: string, actionName: string, buttonId?: string) => {
      if (!documentEditable) return;
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
      const configuredButton = customLayout?.buttons.find(
        (entry) =>
          entry.id === buttonId ||
          replaceTeamPlaceholderAliases(entry.name, teamContext) === actionName,
      );

      handleActionClick(
        matchingTeam ?? teamName,
        action,
        actionName,
        configuredButton?.color ?? getButtonColorByName(actionName),
        buttonId,
        configuredButton?.leadTimeSeconds,
        configuredButton?.lagTimeSeconds,
      );
    },
    [
      activeActions,
      customLayout?.buttons,
      getButtonColorByName,
      documentEditable,
      handleActionClick,
      teamContext,
      teamNames,
    ],
  );

  return {
    triggerAction,
    viewProps: {
      documentEditable,
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
      selectedTimelineLabels,
      statusMessage: documentEditable
        ? statusMessage
        : 'タイムラインの読み込みが完了するまでタグ付けを停止しています。',
      handleLabelSelect: (...args) => {
        if (documentEditable) handleLabelSelect(...args);
      },
      handleCustomButtonClick: (...args) => {
        if (documentEditable) handleCustomButtonClick(...args);
      },
      handleActionClick: (...args) => {
        if (documentEditable) handleActionClick(...args);
      },
      onOpenDetachedWindow: handleOpenDetachedWindow,
    },
  };
};
