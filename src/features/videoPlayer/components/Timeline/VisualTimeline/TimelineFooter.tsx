import type { ReactElement } from 'react';
import Add from '@mui/icons-material/Add';
import Remove from '@mui/icons-material/Remove';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';

interface TimelineFooterProps {
  zoomScale: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onAddRow?: () => void;
}

export const TimelineFooter = ({
  zoomScale,
  canZoomOut,
  canZoomIn,
  onZoomOut,
  onZoomIn,
  onAddRow,
}: TimelineFooterProps): ReactElement => {
  return (
    <Box
      sx={{
        minHeight: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 0.75,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {onAddRow && (
        <Tooltip title="行を追加">
          <IconButton size="small" aria-label="行を追加" onClick={onAddRow}>
            <Add fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ flex: 1 }} />

      <Box
        role="group"
        aria-label="タイムラインの表示倍率"
        sx={{
          display: 'flex',
          alignItems: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        <Tooltip title="タイムラインを縮小">
          <span>
            <IconButton
              size="small"
              aria-label="タイムラインを縮小"
              disabled={!canZoomOut}
              onClick={onZoomOut}
              sx={{ borderRadius: 0 }}
            >
              <Remove fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Typography
          variant="caption"
          aria-live="polite"
          sx={{
            minWidth: 56,
            px: 1,
            textAlign: 'center',
            color: 'text.secondary',
            fontVariantNumeric: 'tabular-nums',
            userSelect: 'none',
          }}
        >
          {Math.round(zoomScale * 100)}%
        </Typography>

        <Tooltip title="タイムラインを拡大">
          <span>
            <IconButton
              size="small"
              aria-label="タイムラインを拡大"
              disabled={!canZoomIn}
              onClick={onZoomIn}
              sx={{ borderRadius: 0 }}
            >
              <Add fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};
