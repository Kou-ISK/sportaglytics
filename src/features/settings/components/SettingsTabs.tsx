import React from 'react';
import { Tabs, Tab, Paper, Box } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import type { AppSettings } from '../../../types/settings/coreTypes';
import type { SettingsTabHandle } from '../types';
import { GeneralSettings } from './GeneralSettings';
import { HotkeySettings } from './HotkeySettings';

interface SettingsTabsProps {
  currentTab: number;
  onTabChange: (newTab: number) => void;
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  generalRef: React.RefObject<SettingsTabHandle | null>;
  hotkeyRef: React.RefObject<SettingsTabHandle | null>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({
  children,
  value,
  index,
}: TabPanelProps): React.ReactElement => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>{children}</Box>
      )}
    </div>
  );
};

export const SettingsTabs = ({
  currentTab,
  onTabChange,
  settings,
  saveSettings,
  generalRef,
  hotkeyRef,
}: SettingsTabsProps): React.ReactElement => {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Tabs
        value={currentTab}
        onChange={(_e, v) => onTabChange(v)}
        aria-label="設定タブ"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
      >
        <Tab
          icon={<TuneIcon fontSize="small" />}
          iconPosition="start"
          label="一般"
          id="settings-tab-0"
          aria-controls="settings-tabpanel-0"
        />
        <Tab
          icon={<KeyboardIcon fontSize="small" />}
          iconPosition="start"
          label="ホットキー"
          id="settings-tab-1"
          aria-controls="settings-tabpanel-1"
        />
      </Tabs>

      <TabPanel value={currentTab} index={0}>
        <GeneralSettings
          ref={generalRef}
          settings={settings}
          onSave={saveSettings}
        />
      </TabPanel>
      <TabPanel value={currentTab} index={1}>
        <HotkeySettings
          ref={hotkeyRef}
          settings={settings}
          onSave={saveSettings}
        />
      </TabPanel>
    </Paper>
  );
};
