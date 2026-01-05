import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Divider,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import type { CodeWindowButton } from '../../../../types/Settings';
import { DEFAULT_BUTTON_COLORS } from './types';
import { DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT } from './utils';

interface ButtonPropertiesEditorProps {
  button: CodeWindowButton | null;
  onUpdate: (button: CodeWindowButton) => void;
  onDelete: () => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
  canvasWidth?: number;
  canvasHeight?: number;
}

const PRESET_COLORS = [
  '#1976d2', // Blue
  '#d32f2f', // Red
  '#388e3c', // Green
  '#f57c00', // Orange
  '#7b1fa2', // Purple
  '#0288d1', // Light Blue
  '#c2185b', // Pink
  '#455a64', // Blue Grey
  '#5d4037', // Brown
  '#616161', // Grey
];

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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          ボタンプロパティ
        </Typography>
        <Tooltip title="ボタンを削除">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>

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
        {/* ボタンタイプ */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>タイプ</InputLabel>
          <Select
            value={button.type}
            label="タイプ"
            onChange={(e) => handleChange('type', e.target.value)}
          >
            <MenuItem value="action">アクション</MenuItem>
            <MenuItem value="label">ラベル</MenuItem>
          </Select>
        </FormControl>

        {/* アクション/ラベル選択 */}
        {button.type === 'action' ? (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              ※Sportscode方式: チームを区別する場合は「チーム名
              アクション名」形式で命名 （例: &quot;Team A ポゼッション&quot;,
              &quot;Team B Attack&quot;）
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>アクション（プリセットから）</InputLabel>
              <Select
                value={
                  availableActions.includes(button.name) ? button.name : ''
                }
                label="アクション（プリセットから）"
                onChange={(e) => handleChange('name', e.target.value)}
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
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例: ${Team1} タックル"
              inputRef={nameInputRef}
              sx={{ mb: 1 }}
            />
            {/* プレースホルダ挿入ボタン */}
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
                onClick={() => insertPlaceholder('${Team1}')}
                sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
              />
              <Chip
                label="${Team2}"
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => insertPlaceholder('${Team2}')}
                sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
              />
              <Chip
                label=" "
                size="small"
                variant="outlined"
                onClick={() => insertPlaceholder(' ')}
                sx={{ cursor: 'pointer', minWidth: 40 }}
                title="スペースを挿入"
              />
            </Box>
          </>
        ) : (
          <>
            {/* ラベルグループ - 選択または自由入力 */}
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>ラベルグループ（既存から選択）</InputLabel>
              <Select
                value={
                  availableLabelGroups.find((g) => g.groupName === button.name)
                    ? button.name
                    : ''
                }
                label="ラベルグループ（既存から選択）"
                onChange={(e) => {
                  handleChange('name', e.target.value);
                  handleChange('labelValue', '');
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
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例: Zone, Technique, Body Part"
              inputRef={nameInputRef}
              sx={{ mb: 1 }}
            />
            {/* プレースホルダ挿入ボタン */}
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
                onClick={() => insertPlaceholder('${Team1}')}
                sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
              />
              <Chip
                label="${Team2}"
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => insertPlaceholder('${Team2}')}
                sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
              />
              <Chip
                label=" "
                size="small"
                variant="outlined"
                onClick={() => insertPlaceholder(' ')}
                sx={{ cursor: 'pointer', minWidth: 40 }}
                title="スペースを挿入"
              />
            </Box>

            {/* ラベル値 - 選択または自由入力 */}
            {currentLabelGroup ? (
              <>
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>ラベル値（既存から選択）</InputLabel>
                  <Select
                    value={
                      currentLabelGroup.options.includes(
                        button.labelValue || '',
                      )
                        ? button.labelValue
                        : ''
                    }
                    label="ラベル値（既存から選択）"
                    onChange={(e) => handleChange('labelValue', e.target.value)}
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
                  onChange={(e) => handleChange('labelValue', e.target.value)}
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
                onChange={(e) => handleChange('labelValue', e.target.value)}
                placeholder="ラベルの値を入力"
                sx={{ mb: 2 }}
              />
            )}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* グループID */}
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
          onChange={(e) => handleChange('groupId', e.target.value || undefined)}
          placeholder="例: possession, scrum"
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        {/* ホットキー設定 */}
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
                  handleChange('hotkey', undefined);
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
      </TabPanel>

      {/* 配置タブ */}
      <TabPanel value={tabIndex} index={1}>
        {/* 位置設定 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          位置 (px)
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="X"
            type="number"
            value={button.x}
            onChange={(e) =>
              handleNumberChange(
                'x',
                e.target.value,
                0,
                canvasWidth - button.width,
              )
            }
            inputProps={{ min: 0, max: canvasWidth - button.width, step: 10 }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Y"
            type="number"
            value={button.y}
            onChange={(e) =>
              handleNumberChange(
                'y',
                e.target.value,
                0,
                canvasHeight - button.height,
              )
            }
            inputProps={{ min: 0, max: canvasHeight - button.height, step: 10 }}
            sx={{ flex: 1 }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* サイズ設定 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          サイズ (px)
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="幅"
            type="number"
            value={button.width}
            onChange={(e) =>
              handleNumberChange(
                'width',
                e.target.value,
                DEFAULT_BUTTON_WIDTH / 2,
                canvasWidth,
              )
            }
            inputProps={{
              min: DEFAULT_BUTTON_WIDTH / 2,
              max: canvasWidth,
              step: 10,
            }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="高さ"
            type="number"
            value={button.height}
            onChange={(e) =>
              handleNumberChange(
                'height',
                e.target.value,
                DEFAULT_BUTTON_HEIGHT / 2,
                canvasHeight,
              )
            }
            inputProps={{
              min: DEFAULT_BUTTON_HEIGHT / 2,
              max: canvasHeight,
              step: 10,
            }}
            sx={{ flex: 1 }}
          />
        </Box>

        {/* クイックサイズ */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          クイックサイズ
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {[
            { label: '小', width: 80, height: 32 },
            {
              label: '標準',
              width: DEFAULT_BUTTON_WIDTH,
              height: DEFAULT_BUTTON_HEIGHT,
            },
            { label: '大', width: 140, height: 50 },
            { label: 'ワイド', width: 180, height: 40 },
            { label: '正方形', width: 80, height: 80 },
          ].map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              size="small"
              onClick={() => {
                handleChange('width', preset.width);
                handleChange('height', preset.height);
              }}
              variant={
                button.width === preset.width && button.height === preset.height
                  ? 'filled'
                  : 'outlined'
              }
              color={
                button.width === preset.width && button.height === preset.height
                  ? 'primary'
                  : 'default'
              }
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </TabPanel>

      {/* スタイルタブ */}
      <TabPanel value={tabIndex} index={2}>
        {/* 色設定 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          背景色
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {PRESET_COLORS.map((color) => (
            <Box
              key={color}
              onClick={() => handleColorChange(color)}
              sx={{
                width: 28,
                height: 28,
                backgroundColor: color,
                borderRadius: 1,
                cursor: 'pointer',
                border:
                  (button.color || DEFAULT_BUTTON_COLORS[button.type]) === color
                    ? '2px solid white'
                    : 'none',
                boxShadow:
                  (button.color || DEFAULT_BUTTON_COLORS[button.type]) === color
                    ? `0 0 0 2px ${color}`
                    : 'none',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
                transition: 'transform 0.1s',
              }}
            />
          ))}
        </Box>

        <TextField
          fullWidth
          size="small"
          label="カスタム色"
          value={localColor || button.color || ''}
          onChange={(e) => setLocalColor(e.target.value)}
          onBlur={() => {
            if (localColor && /^#[0-9A-Fa-f]{6}$/.test(localColor)) {
              handleColorChange(localColor);
            }
          }}
          placeholder="#1976d2"
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        {/* テキスト配置 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          テキスト配置
        </Typography>

        <ToggleButtonGroup
          value={button.textAlign || 'center'}
          exclusive
          onChange={(_, value) => value && handleChange('textAlign', value)}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
        >
          <ToggleButton value="left">
            <FormatAlignLeftIcon />
          </ToggleButton>
          <ToggleButton value="center">
            <FormatAlignCenterIcon />
          </ToggleButton>
          <ToggleButton value="right">
            <FormatAlignRightIcon />
          </ToggleButton>
        </ToggleButtonGroup>

        {/* 角丸 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          角丸: {button.borderRadius ?? 4}px
        </Typography>
        <Slider
          value={button.borderRadius ?? 4}
          min={0}
          max={20}
          step={2}
          onChange={(_, value) => handleChange('borderRadius', value)}
          size="small"
        />

        <Divider sx={{ my: 2 }} />

        {/* プレビュー */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          プレビュー
        </Typography>
        <Box
          sx={{
            p: 2,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: Math.min(button.width, 200),
              height: Math.min(button.height, 80),
              backgroundColor:
                button.color || DEFAULT_BUTTON_COLORS[button.type],
              color: button.textColor || '#fff',
              borderRadius: `${button.borderRadius ?? 4}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                button.textAlign === 'left'
                  ? 'flex-start'
                  : button.textAlign === 'right'
                    ? 'flex-end'
                    : 'center',
              px: 1,
              boxShadow: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {button.type === 'label' && button.labelValue
                ? button.labelValue
                : button.name}
            </Typography>
          </Box>
        </Box>
        {button.team && button.team !== 'shared' && (
          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <Chip
              size="small"
              label={button.team === 'team1' ? 'Team 1' : 'Team 2'}
              color={button.team === 'team1' ? 'primary' : 'error'}
            />
          </Box>
        )}
      </TabPanel>
    </Paper>
  );
};
