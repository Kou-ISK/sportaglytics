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
} from '../../../types/settings/coreTypes';
import { EnhancedCodePanelView } from '../components/Controls/EnhancedCodePanelView';
import { resolveActionLabelGroups } from '../shared/actionLabelGroups';
import {
  sendCodingPanelWindowCommand,
  subscribeCodingPanelWindowSync,
} from '../components/Controls/gateways/codingPanelWindowGateway';
import type { TeamContext } from '../../../utils/teamPlaceholder';
import { useGlobalHotkeys } from '../../../hooks/useGlobalHotkeys';

const fallbackTeamContext: TeamContext = {
  team1Name: 'Team1',
  team2Name: 'Team2',
};

export const CodingPanelWindowScreen = (): React.ReactElement => {
  const [payload, setPayload] = useState<CodingPanelWindowSyncPayload | null>(
    null,
  );
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCodingPanelWindowSync(setPayload);
    sendCodingPanelWindowCommand({ type: 'request-sync' });
    return unsubscribe;
  }, []);

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

  useGlobalHotkeys(payload?.hotkeys ?? [], hotkeyHandlers, hotkeyKeyUpHandlers);

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
    team1Name: payload.teamNames[0] || fallbackTeamContext.team1Name,
    team2Name: payload.teamNames[1] || fallbackTeamContext.team2Name,
  };

  return (
    <Box sx={{ height: '100vh', p: 1.5, boxSizing: 'border-box' }}>
      <EnhancedCodePanelView
        activeMode={payload.activeMode}
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
        handleLabelSelect={handleLabelSelect}
        handleCustomButtonClick={handleCustomButtonClick}
        handleActionClick={handleActionClick}
      />
    </Box>
  );
};
