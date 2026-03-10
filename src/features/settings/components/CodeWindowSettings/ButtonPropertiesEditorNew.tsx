import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Paper, Tabs, Tab, Typography } from '@mui/material';
import type { CodeWindowButton } from '../../../../types/Settings';
import { ButtonPropertiesHeader } from './ButtonPropertiesHeader';
import { ButtonBasicTab } from './ButtonBasicTab';
import { ButtonLayoutTab } from './ButtonLayoutTab';
import { ButtonStyleTab } from './ButtonStyleTab';

interface ButtonPropertiesEditorProps {
  button: CodeWindowButton | null;
  onUpdate: (button: CodeWindowButton) => void;
  onDelete: () => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
  canvasWidth?: number;
  canvasHeight?: number;
}

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

/**
 * キーボードイベントから表示用のキー文字列を生成
 */
const formatKeyCombo = (event: KeyboardEvent): string => {
  const keys: string[] = [];

  if (event.metaKey) keys.push('Command');
  if (event.ctrlKey) keys.push('Control');
  if (event.altKey) keys.push('Option');
  if (event.shiftKey) keys.push('Shift');

  // 修飾キー以外のキー
  if (event.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    const keyName =
      event.key.length === 1 ? event.key.toUpperCase() : event.key;
    keys.push(keyName);
  }

  return keys.join('+');
};

export const ButtonPropertiesEditor: React.FC<ButtonPropertiesEditorProps> = ({
  button,
  onUpdate,
  onDelete,
  availableActions,
  availableLabelGroups,
  canvasWidth = 800,
  canvasHeight = 600,
}) => {
  const [localColor, setLocalColor] = useState(button?.color || '');
  const [tabIndex, setTabIndex] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isCapturingHotkey, setIsCapturingHotkey] = useState(false);
  const [capturedHotkey, setCapturedHotkey] = useState('');

  // ボタンが変更されたらローカル状態をリセット
  useEffect(() => {
    setLocalColor(button?.color || '');
    setCapturedHotkey(button?.hotkey || '');
    setIsCapturingHotkey(false);
  }, [button?.id, button?.color, button?.hotkey]);

  // ホットキーキャプチャ
  useEffect(() => {
    if (!isCapturingHotkey) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Escapeキーでキャンセル
      if (event.key === 'Escape') {
        setIsCapturingHotkey(false);
        setCapturedHotkey(button?.hotkey || '');
        return;
      }

      // 修飾キーのみの場合は無視
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
        return;
      }

      const keyCombo = formatKeyCombo(event);
      setCapturedHotkey(keyCombo);
      setIsCapturingHotkey(false);

      // ボタンに反映
      if (button) {
        onUpdate({ ...button, hotkey: keyCombo });
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCapturingHotkey, button, onUpdate]);

  const handleChange = useCallback(
    (field: keyof CodeWindowButton, value: unknown) => {
      if (!button) return;
      onUpdate({ ...button, [field]: value });
    },
    [button, onUpdate],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      setLocalColor(color);
      if (button) {
        onUpdate({ ...button, color });
      }
    },
    [button, onUpdate],
  );

  // プレースホルダを挿入
  const insertPlaceholder = useCallback(
    (placeholder: string) => {
      if (!button) return;
      const input = nameInputRef.current;
      if (input) {
        const start = input.selectionStart ?? button.name.length;
        const end = input.selectionEnd ?? button.name.length;
        const newValue =
          button.name.slice(0, start) + placeholder + button.name.slice(end);
        onUpdate({ ...button, name: newValue });
        // カーソル位置を更新
        setTimeout(() => {
          input.focus();
          const newPos = start + placeholder.length;
          input.setSelectionRange(newPos, newPos);
        }, 0);
      } else {
        // inputがなければ末尾に追加
        onUpdate({ ...button, name: button.name + placeholder });
      }
    },
    [button, onUpdate],
  );

  // 数値入力ハンドラ
  const handleNumberChange = useCallback(
    (
      field: keyof CodeWindowButton,
      value: string,
      min: number,
      max: number,
    ) => {
      if (!button) return;
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        onUpdate({ ...button, [field]: Math.max(min, Math.min(max, num)) });
      }
    },
    [button, onUpdate],
  );

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

  const currentLabelGroup = availableLabelGroups.find(
    (g) => g.groupName === button.name,
  );

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

      {/* タブナビゲーション */}
      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab label="基本" sx={{ minWidth: 0, px: 1 }} />
        <Tab label="配置" sx={{ minWidth: 0, px: 1 }} />
        <Tab label="スタイル" sx={{ minWidth: 0, px: 1 }} />
      </Tabs>

      {/* 基本タブ */}
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
          onChange={handleChange}
          onInsertPlaceholder={insertPlaceholder}
        />
      </TabPanel>

      {/* 配置タブ */}
      <TabPanel value={tabIndex} index={1}>
        <ButtonLayoutTab
          button={button}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onNumberChange={handleNumberChange}
          onChange={handleChange}
        />
      </TabPanel>

      {/* スタイルタブ */}
      <TabPanel value={tabIndex} index={2}>
        <ButtonStyleTab
          button={button}
          localColor={localColor}
          setLocalColor={setLocalColor}
          onColorChange={handleColorChange}
          onNumberChange={handleNumberChange}
          onChange={handleChange}
        />
      </TabPanel>
    </Paper>
  );
};
