import React from 'react';
import {
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  IconButton,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import DeleteIcon from '@mui/icons-material/Delete';
import type { CodeWindowButton } from '../../../../types/Settings';

type LabelGroup = { groupName: string; options: string[] };

type ButtonBasicTabProps = {
  button: CodeWindowButton;
  availableActions: string[];
  availableLabelGroups: LabelGroup[];
  currentLabelGroup?: LabelGroup;
  nameInputRef: React.RefObject<HTMLInputElement>;
  capturedHotkey: string;
  isCapturingHotkey: boolean;
  setIsCapturingHotkey: (value: boolean) => void;
  setCapturedHotkey: (value: string) => void;
  onChange: (field: keyof CodeWindowButton, value: unknown) => void;
  onInsertPlaceholder: (placeholder: string) => void;
};

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
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ width: '100%', mb: 0.5 }}
            >
              クリックで挿入:
            </Typography>
            <Chip
              label="${Team1}"
              size="small"
              variant="outlined"
              color="error"
              onClick={() => onInsertPlaceholder('${Team1}')}
              sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
            />
            <Chip
              label="${Team2}"
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => onInsertPlaceholder('${Team2}')}
              sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
            />
            <Chip
              label=" "
              size="small"
              variant="outlined"
              onClick={() => onInsertPlaceholder(' ')}
              sx={{ cursor: 'pointer', minWidth: 40 }}
              title="スペースを挿入"
            />
          </Box>
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
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ width: '100%', mb: 0.5 }}
            >
              クリックで挿入:
            </Typography>
            <Chip
              label="${Team1}"
              size="small"
              variant="outlined"
              color="error"
              onClick={() => onInsertPlaceholder('${Team1}')}
              sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
            />
            <Chip
              label="${Team2}"
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => onInsertPlaceholder('${Team2}')}
              sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
            />
            <Chip
              label=" "
              size="small"
              variant="outlined"
              onClick={() => onInsertPlaceholder(' ')}
              sx={{ cursor: 'pointer', minWidth: 40 }}
              title="スペースを挿入"
            />
          </Box>

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

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        ホットキー
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1 }}
      >
        ボタンを起動するショートカットキー（Shift+キーで2チーム目）
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box
          onClick={() => setIsCapturingHotkey(true)}
          sx={{
            flex: 1,
            p: 1.5,
            border: '1px solid',
            borderColor: isCapturingHotkey ? 'primary.main' : 'divider',
            borderRadius: 1,
            backgroundColor: isCapturingHotkey
              ? 'action.selected'
              : 'background.paper',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <KeyboardIcon
            fontSize="small"
            color={isCapturingHotkey ? 'primary' : 'action'}
          />
          <Typography
            variant="body2"
            color={
              isCapturingHotkey
                ? 'primary'
                : capturedHotkey
                  ? 'text.primary'
                  : 'text.secondary'
            }
            sx={{ fontFamily: 'monospace' }}
          >
            {isCapturingHotkey
              ? 'キーを押してください...'
              : capturedHotkey || '未設定'}
          </Typography>
        </Box>
        {capturedHotkey && (
          <Tooltip title="ホットキーをクリア">
            <IconButton
              size="small"
              onClick={() => {
                setCapturedHotkey('');
                onChange('hotkey', undefined);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {isCapturingHotkey && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          Escでキャンセル
        </Typography>
      )}
    </>
  );
};
