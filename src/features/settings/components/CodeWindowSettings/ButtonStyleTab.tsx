import React from 'react';
import {
  Box,
  Chip,
  Divider,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import type { CodeWindowButton } from '../../../../types/Settings';
import { DEFAULT_BUTTON_COLORS } from './types';

const PRESET_COLORS = [
  '#1976d2',
  '#d32f2f',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#0288d1',
  '#c2185b',
  '#455a64',
  '#5d4037',
  '#616161',
];

type ButtonStyleTabProps = {
  button: CodeWindowButton;
  localColor: string;
  setLocalColor: (value: string) => void;
  onColorChange: (color: string) => void;
  onNumberChange: (
    field: keyof CodeWindowButton,
    value: string,
    min: number,
    max: number,
  ) => void;
  onChange: (field: keyof CodeWindowButton, value: unknown) => void;
};

export const ButtonStyleTab = ({
  button,
  localColor,
  setLocalColor,
  onColorChange,
  onNumberChange,
  onChange,
}: ButtonStyleTabProps) => {
  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        背景色
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
        {PRESET_COLORS.map((color) => (
          <Box
            key={color}
            onClick={() => onColorChange(color)}
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
        onChange={(event) => setLocalColor(event.target.value)}
        onBlur={() => {
          if (localColor && /^#[0-9A-Fa-f]{6}$/.test(localColor)) {
            onColorChange(localColor);
          }
        }}
        placeholder="#1976d2"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        テキストサイズ (px)
      </Typography>
      <TextField
        size="small"
        type="number"
        fullWidth
        value={button.fontSize ?? 14}
        onChange={(event) => onNumberChange('fontSize', event.target.value, 8, 48)}
        inputProps={{ min: 8, max: 48, step: 1 }}
        sx={{ mb: 2 }}
      />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        テキスト配置
      </Typography>

      <ToggleButtonGroup
        value={button.textAlign || 'center'}
        exclusive
        onChange={(_, value) => value && onChange('textAlign', value)}
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

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        角丸: {button.borderRadius ?? 4}px
      </Typography>
      <Slider
        value={button.borderRadius ?? 4}
        min={0}
        max={20}
        step={2}
        onChange={(_, value) => onChange('borderRadius', value)}
        size="small"
      />

      <Divider sx={{ my: 2 }} />

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
            backgroundColor: button.color || DEFAULT_BUTTON_COLORS[button.type],
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
              fontSize: `${button.fontSize ?? 14}px`,
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
    </>
  );
};
