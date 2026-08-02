import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Box } from '@mui/material';
import type { CodingPanelWindowSyncPayload } from '../../../types/ipc/codingPanelWindow';
import type {
  ActionDefinition,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../types/settings/coreTypes';
import { EnhancedCodePanelView } from '../components/Controls/EnhancedCodePanelView';
import { resolveActionLabelGroups } from '../shared/actionLabelGroups';
import {
  sendCodingPanelWindowCommand,
  subscribeCodingPanelWindowSync,
} from '../components/Controls/gateways/codingPanelWindowGateway';
import type { TeamContext } from '../../../utils/teamPlaceholder';
import { useGlobalHotkeys } from '../../../hooks/useGlobalHotkeys';
import { CodingPanelWindowEditPane } from './CodingPanelWindowEditPane';
import {
  CodingPanelWindowToolbar,
  type CodingPanelWindowMode,
} from './CodingPanelWindowToolbar';

const createEmptyLayout = (
  canvasWidth: number,
  canvasHeight: number,
): CodeWindowLayout => ({
  id: 'runtime-code-window',
  name: 'Code Window',
  canvasWidth,
  canvasHeight,
  buttons: [],
  buttonLinks: [],
});

export const CodingPanelWindowScreen = (): React.ReactElement => {
  const [payload, setPayload] = useState<CodingPanelWindowSyncPayload | null>(
    null,
  );
  const [windowMode, setWindowMode] = useState<CodingPanelWindowMode>('code');
  const [draftLayout, setDraftLayout] = useState<CodeWindowLayout | null>(null);
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);
  const syncedPayloadModeRef = useRef<'code' | 'label' | null>(null);
  const syncedFilePathRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeCodingPanelWindowSync(setPayload);
    sendCodingPanelWindowCommand({ type: 'request-sync' });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!payload) return;
    const documentChanged =
      syncedFilePathRef.current !== payload.codeWindowFilePath;
    if (documentChanged || windowMode !== 'edit') {
      setDraftLayout(payload.customLayout);
    }
    if (
      windowMode !== 'edit' &&
      syncedPayloadModeRef.current !== payload.activeMode
    ) {
      setWindowMode(payload.activeMode);
    }
    syncedPayloadModeRef.current = payload.activeMode;
    syncedFilePathRef.current = payload.codeWindowFilePath;
  }, [payload, windowMode]);

  const handleCustomButtonClick = useCallback((button: CodeWindowButton) => {
    sendCodingPanelWindowCommand({
      type: 'custom-button-click',
      buttonId: button.id,
    });
  }, []);

  const handleActionClick = useCallback(
    (teamName: string, action: ActionDefinition) => {
      sendCodingPanelWindowCommand({
        type: 'action-click',
        teamName,
        actionName: action.action,
      });
    },
    [],
  );

  const handleLabelSelect = useCallback(
    (actionName: string, groupName: string, option: string) => {
      sendCodingPanelWindowCommand({
        type: 'label-select',
        actionName,
        groupName,
        option,
      });
    },
    [],
  );

  const getActionLabels = useCallback(
    (action: ActionDefinition) => resolveActionLabelGroups(action),
    [],
  );

  const hotkeyHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    payload?.hotkeys.forEach((hotkey) => {
      handlers[hotkey.id] = () =>
        sendCodingPanelWindowCommand({
          type: 'hotkey-key-down',
          hotkeyId: hotkey.id,
        });
    });
    return handlers;
  }, [payload?.hotkeys]);

  const hotkeyKeyUpHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    payload?.hotkeys.forEach((hotkey) => {
      handlers[hotkey.id] = () =>
        sendCodingPanelWindowCommand({
          type: 'hotkey-key-up',
          hotkeyId: hotkey.id,
        });
    });
    return handlers;
  }, [payload?.hotkeys]);

  useGlobalHotkeys(
    windowMode === 'edit' ? [] : (payload?.hotkeys ?? []),
    hotkeyHandlers,
    hotkeyKeyUpHandlers,
  );

  const handleModeChange = useCallback(
    (
      _: React.MouseEvent<HTMLElement>,
      nextMode: CodingPanelWindowMode | null,
    ): void => {
      if (!nextMode) return;
      if (nextMode === 'edit') {
        setDraftLayout(
          (current) =>
            current ?? payload?.customLayout ?? createEmptyLayout(720, 480),
        );
      }
      if (nextMode === 'code' || nextMode === 'label') {
        sendCodingPanelWindowCommand({ type: 'set-mode', mode: nextMode });
      }
      setWindowMode(nextMode);
    },
    [payload?.customLayout],
  );

  const handleDraftLayoutChange = useCallback(
    (layout: CodeWindowLayout): void => {
      setDraftLayout(layout);
      sendCodingPanelWindowCommand({
        type: 'layout-updated',
        layout,
      });
    },
    [],
  );

  const handleSave = useCallback(
    (saveAs: boolean): void => {
      if (!draftLayout) return;
      sendCodingPanelWindowCommand({
        type: 'save-layout',
        layout: draftLayout,
        saveAs,
        filePath: saveAs ? undefined : payload?.codeWindowFilePath,
      });
    },
    [draftLayout, payload?.codeWindowFilePath],
  );

  if (!payload) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          メインウィンドウのコードパネル状態を待機しています。
        </Alert>
      </Box>
    );
  }

  const teamContext: TeamContext = {
    team1Name: payload.teamNames[0] || '',
    team2Name: payload.teamNames[1] || '',
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <CodingPanelWindowToolbar
        mode={windowMode}
        title={draftLayout?.name ?? payload.customLayout?.name ?? 'Code Window'}
        canSave={Boolean(draftLayout)}
        onModeChange={handleModeChange}
        onSave={() => handleSave(false)}
        onSaveAs={() => handleSave(true)}
      />

      {windowMode === 'edit' ? (
        <CodingPanelWindowEditPane
          layout={draftLayout}
          onLayoutChange={handleDraftLayoutChange}
        />
      ) : (
        <Box sx={{ minHeight: 0, flex: 1, p: 1.5, boxSizing: 'border-box' }}>
          <EnhancedCodePanelView
            activeMode={windowMode}
            customLayout={payload.customLayout}
            teamContext={teamContext}
            activeRecordings={payload.activeRecordings}
            primaryAction={payload.primaryAction}
            activeLabelButtons={payload.activeLabelButtons}
            isRecording={payload.isRecording}
            layoutContainerRef={layoutContainerRef}
            teamNames={payload.teamNames}
            firstTeamName={payload.firstTeamName}
            activeActions={payload.activeActions}
            getActionLabels={getActionLabels}
            labelSelections={payload.labelSelections}
            selectedTimelineLabels={payload.selectedTimelineLabels}
            statusMessage={payload.statusMessage}
            handleLabelSelect={handleLabelSelect}
            handleCustomButtonClick={handleCustomButtonClick}
            handleActionClick={handleActionClick}
          />
        </Box>
      )}
    </Box>
  );
};
