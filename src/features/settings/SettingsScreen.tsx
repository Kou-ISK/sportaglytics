import React from 'react';
import { Alert, Box, CircularProgress, Container, Stack } from '@mui/material';
import { SettingsTabs } from './components/SettingsTabs';
import { SettingsHeader } from './components/SettingsHeader';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { useSettingsScreenController } from './hooks/useSettingsScreenController';

export const SettingsScreen = (): React.ReactElement => {
  const {
    settings,
    isLoading,
    error,
    saveSettings,
    generalRef,
    hotkeyRef,
    currentTab,
    requestTabChange,
    confirmDialogOpen,
    confirmSwitch,
    cancelSwitch,
    handleClose,
  } = useSettingsScreenController();

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={22} />
          <Box>設定を読み込み中…</Box>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SettingsHeader onClose={handleClose} />

      <Container
        maxWidth="md"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflow: 'auto',
          py: { xs: 1.5, sm: 2.5 },
        }}
      >
        <SettingsTabs
          currentTab={currentTab}
          onTabChange={requestTabChange}
          settings={settings}
          saveSettings={saveSettings}
          generalRef={generalRef}
          hotkeyRef={hotkeyRef}
        />
      </Container>

      <UnsavedChangesDialog
        open={confirmDialogOpen}
        onCancel={cancelSwitch}
        onConfirm={confirmSwitch}
      />
    </Box>
  );
};
