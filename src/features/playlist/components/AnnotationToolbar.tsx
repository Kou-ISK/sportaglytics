import React from 'react';
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Portal,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowRightAlt,
  Brush,
  Clear,
  CropSquare,
  PauseCircle,
  RadioButtonUnchecked,
  TextFields,
  Timeline,
  Undo,
  DragIndicator,
  OpenWith,
} from '@mui/icons-material';
import type { DrawingToolType } from '../../../types/Playlist';

type AnnotationToolbarProps = {
  isActive: boolean;
  toolbarRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isDragging: boolean;
  onDragStart: (event: React.MouseEvent) => void;
  tool: DrawingToolType;
  onToolChange: (tool: DrawingToolType) => void;
  colors: string[];
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (value: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
  freezeDuration: number;
  minFreezeDuration: number;
  onFreezeDurationChange: (value: number) => void;
};

export const AnnotationToolbar = ({
  isActive,
  toolbarRef,
  position,
  isDragging,
  onDragStart,
  tool,
  onToolChange,
  colors,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  onUndo,
  onClear,
  freezeDuration,
  minFreezeDuration,
  onFreezeDurationChange,
}: AnnotationToolbarProps) => {
  if (!isActive) return null;

  return (
    <Portal>
      <Paper
        ref={toolbarRef}
        sx={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          p: 0.5,
          bgcolor: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(6px)',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 0.4,
          boxShadow: 6,
          borderRadius: 2,
          zIndex: 2000,
          cursor: isDragging ? 'grabbing' : 'default',
          userSelect: 'none',
          width: 'fit-content',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          onMouseDown={onDragStart}
          sx={{
            cursor: 'grab',
            color: 'grey.300',
            fontSize: 10,
            pb: 0.25,
          }}
        >
          <DragIndicator fontSize="small" />
          <Typography variant="caption">移動</Typography>
        </Stack>

        {tool === 'select' && (
          <Typography
            variant="caption"
            sx={{
              fontSize: 9.5,
              color: 'grey.400',
              lineHeight: 1.1,
              px: 0.25,
            }}
          >
            クリック:選択
            <br />
            ドラッグ:移動
            <br />
            Delete:削除
          </Typography>
        )}

        <ToggleButtonGroup
          value={tool}
          exclusive
          onChange={(_, value) => value && onToolChange(value)}
          size="small"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 0.25,
            '& .MuiToggleButton-root': { minWidth: 28, height: 28, p: 0 },
          }}
        >
          <ToggleButton value="pen">
            <Tooltip title="ペン">
              <Brush fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="select">
            <Tooltip title="選択/ドラッグで移動・Deleteで削除">
              <OpenWith fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="line">
            <Tooltip title="直線">
              <Timeline fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="arrow">
            <Tooltip title="矢印">
              <ArrowRightAlt fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="rectangle">
            <Tooltip title="四角形">
              <CropSquare fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="circle">
            <Tooltip title="円/楕円">
              <RadioButtonUnchecked fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="text">
            <Tooltip title="テキスト">
              <TextFields fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider sx={{ borderColor: 'grey.700' }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0.25,
          }}
        >
          {colors.map((paletteColor) => (
            <IconButton
              key={paletteColor}
              size="small"
              onClick={() => onColorChange(paletteColor)}
              sx={{
                width: 16,
                height: 16,
                bgcolor: paletteColor,
                border:
                  color === paletteColor
                    ? '2px solid white'
                    : '1px solid #666',
                '&:hover': { bgcolor: paletteColor },
              }}
            />
          ))}
        </Box>

        <Divider sx={{ borderColor: 'grey.700' }} />

        <Stack spacing={0.25} sx={{ px: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: 10 }}>
            太さ
          </Typography>
          <Slider
            size="small"
            value={strokeWidth}
            min={1}
            max={10}
            onChange={(_, value) => onStrokeWidthChange(value as number)}
            sx={{ width: '100%', mt: -0.5 }}
          />
        </Stack>

        <Divider sx={{ borderColor: 'grey.700' }} />

        <Stack direction="row" spacing={0.25}>
          <Tooltip title="元に戻す">
            <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
              <Undo fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="全てクリア">
            <IconButton size="small" onClick={onClear}>
              <Clear fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ borderColor: 'grey.700' }} />

        <Stack spacing={0.25} sx={{ px: 0.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <PauseCircle fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography variant="caption" sx={{ fontSize: 10 }}>
              停止 {freezeDuration}秒
            </Typography>
          </Stack>
          <Slider
            size="small"
            value={freezeDuration}
            min={minFreezeDuration}
            max={10}
            step={0.5}
            onChange={(_, value) => onFreezeDurationChange(value as number)}
            sx={{ width: '100%' }}
          />
        </Stack>
      </Paper>
    </Portal>
  );
};
