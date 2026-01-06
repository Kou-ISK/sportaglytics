import React, { useRef } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { useSettings } from '../hooks/useSettings';
import { SettingsTabs } from './settings/components/SettingsTabs';
import { SettingsHeader } from './settings/components/SettingsHeader';
import { useUnsavedTabSwitch } from './settings/hooks/useUnsavedTabSwitch';
import { UnsavedChangesDialog } from './settings/components/UnsavedChangesDialog';

export interface SettingsTabHandle {
  hasUnsavedChanges: () => boolean;
  save?: () => Promise<boolean>;
}

export const SettingsPage: React.FC = () => {
  const { settings, isLoading, error, saveSettings } = useSettings();

  // 各タブのRefを保持
  const generalRef = useRef<SettingsTabHandle>(null);
  const hotkeyRef = useRef<SettingsTabHandle>(null);
  const codeWindowRef = useRef<SettingsTabHandle>(null);

  const checkUnsavedChanges = (tabIndex: number): boolean => {
    switch (tabIndex) {
      case 0:
        return generalRef.current?.hasUnsavedChanges() || false;
      case 1:
        return hotkeyRef.current?.hasUnsavedChanges() || false;
      case 2:
        return codeWindowRef.current?.hasUnsavedChanges() || false;
      default:
        return false;
    }
  };

  const {
    currentTab,
    requestTabChange,
    confirmDialogOpen,
    confirmSwitch,
    cancelSwitch,
  } = useUnsavedTabSwitch({
    hasUnsavedChanges: checkUnsavedChanges,
  });

  const handleClose = async () => {
    // 専用ウィンドウなら閉じる、従来の単一ウィンドウ動作ではメインへ戻す
    const api = globalThis.window.electronAPI;
    if (api?.isSettingsWindowOpen) {
      const isDetached = await api.isSettingsWindowOpen();
      if (isDetached && api.closeSettingsWindow) {
        await api.closeSettingsWindow();
        return;
      }
    }

    const event = new CustomEvent('back-to-main');
    globalThis.dispatchEvent(event);
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>設定を読み込み中...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error">{error}</Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SettingsHeader onClose={handleClose} />

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        <SettingsTabs
          currentTab={currentTab}
          onTabChange={requestTabChange}
          settings={settings}
          saveSettings={saveSettings}
          generalRef={generalRef}
          hotkeyRef={hotkeyRef}
          codeWindowRef={codeWindowRef}
        />
      </Container>

      {/* 未保存の変更警告ダイアログ */}
      <UnsavedChangesDialog
        open={confirmDialogOpen}
        onCancel={cancelSwitch}
        onConfirm={confirmSwitch}
      />
    </Box>
  );
};
