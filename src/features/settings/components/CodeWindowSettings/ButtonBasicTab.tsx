import React from 'react';
import {
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ButtonHotkeyField } from './ButtonHotkeyField';
import { ButtonPlaceholderChips } from './ButtonPlaceholderChips';
import type { ButtonBasicTabProps } from './ButtonBasicTab.types';

export const ButtonBasicTab = ({
  button,
  availableActions,
  availableLabelGroups,
  currentLabelGroup,
  nameInputRef,
  capturedHotkey,
  isCapturingHotkey,
  setIsCapturingHotkey,
  setCapturedHotkey,
  onChange,
  onInsertPlaceholder,
}: ButtonBasicTabProps) => {
  return (
    <>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>タイプ</InputLabel>
        <Select
          value={button.type}
          label="タイプ"
          onChange={(event) => onChange('type', event.target.value)}
        >
          <MenuItem value="action">アクション</MenuItem>
          <MenuItem value="label">ラベル</MenuItem>
        </Select>
      </FormControl>

      {button.type === 'action' ? (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            ※Sportscode方式: チームを区別する場合は「チーム名 アクション名」形式で命名 （例: &quot;Team A ポゼッション&quot;,
            &quot;Team B Attack&quot;）
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>アクション（プリセットから）</InputLabel>
            <Select
              value={availableActions.includes(button.name) ? button.name : ''}
              label="アクション（プリセットから）"
              onChange={(event) => onChange('name', event.target.value)}
            >
              {availableActions.map((action) => (
                <MenuItem key={action} value={action}>
                  {action}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label="ボタン名（自由入力）"
            value={button.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="例: ${Team1} タックル"
            inputRef={nameInputRef}
            sx={{ mb: 1 }}
          />
          <ButtonPlaceholderChips onInsertPlaceholder={onInsertPlaceholder} />
        </>
      ) : (
        <>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>ラベルグループ（既存から選択）</InputLabel>
            <Select
              value={
                availableLabelGroups.find((group) => group.groupName === button.name)
                  ? button.name
                  : ''
              }
              label="ラベルグループ（既存から選択）"
              onChange={(event) => {
                onChange('name', event.target.value);
                onChange('labelValue', '');
              }}
            >
              <MenuItem value="">
                <em>カスタム入力</em>
              </MenuItem>
              {availableLabelGroups.map((group) => (
                <MenuItem key={group.groupName} value={group.groupName}>
                  {group.groupName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label="グループ名（自由入力）"
            value={button.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="例: Zone, Technique, Body Part"
            inputRef={nameInputRef}
            sx={{ mb: 1 }}
          />
          <ButtonPlaceholderChips onInsertPlaceholder={onInsertPlaceholder} />

          {currentLabelGroup ? (
            <>
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel>ラベル値（既存から選択）</InputLabel>
                <Select
                  value={
                    currentLabelGroup.options.includes(button.labelValue || '')
                      ? button.labelValue
                      : ''
                  }
                  label="ラベル値（既存から選択）"
                  onChange={(event) => onChange('labelValue', event.target.value)}
                >
                  <MenuItem value="">
                    <em>カスタム入力</em>
                  </MenuItem>
                  {currentLabelGroup.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                label="ラベル値（自由入力）"
                value={button.labelValue || ''}
                onChange={(event) => onChange('labelValue', event.target.value)}
                placeholder="例: Left, Right, Center"
                sx={{ mb: 2 }}
              />
            </>
          ) : (
            <TextField
              fullWidth
              size="small"
              label="ラベル値"
              value={button.labelValue || ''}
              onChange={(event) => onChange('labelValue', event.target.value)}
              placeholder="ラベルの値を入力"
              sx={{ mb: 2 }}
            />
          )}
        </>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        グループID（排他制御用）
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1 }}
      >
        同じグループIDを持つボタンは排他的に動作します（1つ選択で他が解除）
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={button.groupId || ''}
        onChange={(event) => onChange('groupId', event.target.value || undefined)}
        placeholder="例: possession, scrum"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 2 }} />

      <ButtonHotkeyField
        capturedHotkey={capturedHotkey}
        isCapturingHotkey={isCapturingHotkey}
        setIsCapturingHotkey={setIsCapturingHotkey}
        onClear={() => {
          setCapturedHotkey('');
          onChange('hotkey', undefined);
        }}
      />
    </>
  );
};
