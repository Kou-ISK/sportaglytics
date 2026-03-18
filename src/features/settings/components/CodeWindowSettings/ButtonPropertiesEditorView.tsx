import React from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { ButtonPropertiesHeader } from './ButtonPropertiesHeader';
import { ButtonBasicTab } from './ButtonBasicTab';
import { ButtonLayoutTab } from './ButtonLayoutTab';
import { ButtonStyleTab } from './ButtonStyleTab';
import type { ButtonPropertiesEditorViewProps } from './ButtonPropertiesEditor.types';

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

export const ButtonPropertiesEditorView: React.FC<
  ButtonPropertiesEditorViewProps
> = ({
  button,
  onDelete,
  availableActions,
  availableLabelGroups,
  canvasWidth,
  canvasHeight,
  localColor,
  tabIndex,
  currentLabelGroup,
  nameInputRef,
  capturedHotkey,
  isCapturingHotkey,
  onTabChange,
  setLocalColor,
  setIsCapturingHotkey,
  setCapturedHotkey,
  onChange,
  onInsertPlaceholder,
  onColorChange,
  onNumberChange,
}) => {
  if (!button) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          height: '100%',
          backgroundColor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          ボタンを選択してプロパティを編集
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: '100%',
        backgroundColor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'auto',
      }}
      tabIndex={0}
    >
      <ButtonPropertiesHeader onDelete={onDelete} />

      <Tabs
        value={tabIndex}
        onChange={(_, value) => onTabChange(value)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab label="基本" sx={{ minWidth: 0, px: 1 }} />
        <Tab label="配置" sx={{ minWidth: 0, px: 1 }} />
        <Tab label="スタイル" sx={{ minWidth: 0, px: 1 }} />
      </Tabs>

      <TabPanel value={tabIndex} index={0}>
        <ButtonBasicTab
          button={button}
          availableActions={availableActions}
          availableLabelGroups={availableLabelGroups}
          currentLabelGroup={currentLabelGroup}
          nameInputRef={nameInputRef}
          capturedHotkey={capturedHotkey}
          isCapturingHotkey={isCapturingHotkey}
          setIsCapturingHotkey={setIsCapturingHotkey}
          setCapturedHotkey={setCapturedHotkey}
          onChange={onChange}
          onInsertPlaceholder={onInsertPlaceholder}
        />
      </TabPanel>

      <TabPanel value={tabIndex} index={1}>
        <ButtonLayoutTab
          button={button}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onNumberChange={onNumberChange}
          onChange={onChange}
        />
      </TabPanel>

      <TabPanel value={tabIndex} index={2}>
        <ButtonStyleTab
          button={button}
          localColor={localColor}
          setLocalColor={setLocalColor}
          onColorChange={onColorChange}
          onNumberChange={onNumberChange}
          onChange={onChange}
        />
      </TabPanel>
    </Paper>
  );
};
