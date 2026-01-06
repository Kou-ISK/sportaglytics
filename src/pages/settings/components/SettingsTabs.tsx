import React from 'react';
import { Tabs, Tab, Paper, Box } from '@mui/material';
import { GeneralSettings } from './GeneralSettings';
import { HotkeySettings } from './HotkeySettings';
import { CodeWindowSettings } from './CodeWindowSettings';
import type { SettingsTabHandle } from '../../SettingsPage';
import type { AppSettings } from '../../../types/Settings';

interface SettingsTabsProps {
  currentTab: number;
  onTabChange: (newTab: number) => void;
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  generalRef: React.RefObject<SettingsTabHandle>;
  hotkeyRef: React.RefObject<SettingsTabHandle>;
  codeWindowRef: React.RefObject<SettingsTabHandle>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

export const SettingsTabs: React.FC<SettingsTabsProps> = ({
  currentTab,
  onTabChange,
  settings,
  saveSettings,
  generalRef,
  hotkeyRef,
  codeWindowRef,
}) => {
  return (
    <Paper elevation={2}>
      <Tabs
        value={currentTab}
        onChange={(_e, v) => onTabChange(v)}
        aria-label="設定タブ"
        variant="fullWidth"
      >
        <Tab label="一般" id="settings-tab-0" />
        <Tab label="ホットキー" id="settings-tab-1" />
        <Tab label="コードウィンドウ" id="settings-tab-2" />
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
      <TabPanel value={currentTab} index={2}>
        <CodeWindowSettings
          ref={codeWindowRef}
          settings={settings}
          onSave={saveSettings}
        />
      </TabPanel>
    </Paper>
  );
};
