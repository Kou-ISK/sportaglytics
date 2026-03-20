import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { SettingsTabs } from './components/SettingsTabs';
import { SettingsHeader } from './components/SettingsHeader';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { useSettingsScreenController } from './hooks/useSettingsScreenController';

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    isLoading,
    error,
    saveSettings,
    generalRef,
    hotkeyRef,
    codeWindowRef,
    currentTab,
    requestTabChange,
    confirmDialogOpen,
    confirmSwitch,
    cancelSwitch,
    handleClose,
  } = useSettingsScreenController();

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
