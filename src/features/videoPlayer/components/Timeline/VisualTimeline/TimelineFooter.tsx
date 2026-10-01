import type { ReactElement } from 'react';
import Add from '@mui/icons-material/Add';
import Remove from '@mui/icons-material/Remove';
import Search from '@mui/icons-material/Search';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import type { TimelineReviewViewProps } from './review/TimelineReviewView';

interface TimelineFooterProps {
  review?: Pick<
    TimelineReviewViewProps,
    'open' | 'onToggle' | 'toggleRef' | 'totalCount'
  >;
  rowCount?: number;
  selectedCount?: number;
  zoomScale: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onAddRow?: () => void;
}

export const TimelineFooter = ({
  review,
  rowCount,
  selectedCount,
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
          <IconButton
            size="small"
            aria-label="行を追加"
            onClick={() => onAddRow()}
          >
            <Add fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {rowCount !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {rowCount} 行
        </Typography>
      )}
      {review && (
        <Button
          size="small"
          startIcon={<Search fontSize="small" />}
          ref={review.toggleRef}
          aria-expanded={review.open}
          aria-controls={review.open ? 'timeline-review' : undefined}
          onClick={review.onToggle}
          sx={{ whiteSpace: 'nowrap' }}
        >
          場面を検索
        </Button>
      )}
      {review && (
        <Typography variant="caption" color="text.secondary">
          {review.totalCount} 件
        </Typography>
      )}
      {!!selectedCount && (
        <Typography variant="caption" color="primary.main">
          {selectedCount} 件選択
        </Typography>
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
            fontFamily: (theme) => theme.custom.typography.fontFamilyMono,
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
