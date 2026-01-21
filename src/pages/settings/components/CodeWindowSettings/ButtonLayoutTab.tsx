import React from 'react';
import { Box, Chip, Divider, TextField, Typography } from '@mui/material';
import type { CodeWindowButton } from '../../../../types/Settings';
import { DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_WIDTH } from './utils';

type ButtonLayoutTabProps = {
  button: CodeWindowButton;
  canvasWidth: number;
  canvasHeight: number;
  onNumberChange: (
    field: keyof CodeWindowButton,
    value: string,
    min: number,
    max: number,
  ) => void;
  onChange: (field: keyof CodeWindowButton, value: unknown) => void;
};

export const ButtonLayoutTab = ({
  button,
  canvasWidth,
  canvasHeight,
  onNumberChange,
  onChange,
}: ButtonLayoutTabProps) => {
  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        位置 (px)
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          label="X"
          type="number"
          value={button.x}
          onChange={(event) =>
            onNumberChange('x', event.target.value, 0, canvasWidth - button.width)
          }
          inputProps={{ min: 0, max: canvasWidth - button.width, step: 10 }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Y"
          type="number"
          value={button.y}
          onChange={(event) =>
            onNumberChange('y', event.target.value, 0, canvasHeight - button.height)
          }
          inputProps={{ min: 0, max: canvasHeight - button.height, step: 10 }}
          sx={{ flex: 1 }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        サイズ (px)
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          label="幅"
          type="number"
          value={button.width}
          onChange={(event) =>
            onNumberChange(
              'width',
              event.target.value,
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
          onChange={(event) =>
            onNumberChange(
              'height',
              event.target.value,
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
              onChange('width', preset.width);
              onChange('height', preset.height);
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
    </>
  );
};
