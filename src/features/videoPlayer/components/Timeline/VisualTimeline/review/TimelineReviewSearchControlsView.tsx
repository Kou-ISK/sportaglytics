import type { ReactElement } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import type { TimelineReviewViewProps } from './TimelineReviewView';

type ControlsProps = Pick<
  TimelineReviewViewProps,
  | 'query'
  | 'inputRef'
  | 'totalCount'
  | 'matchCount'
  | 'results'
  | 'selectedItem'
  | 'onQueryChange'
  | 'onClose'
  | 'onActivate'
  | 'onFocusDetails'
>;

export const TimelineReviewSearchControlsView = ({
  query,
  inputRef,
  totalCount,
  matchCount,
  results,
  selectedItem,
  onQueryChange,
  onClose,
  onActivate,
  onFocusDetails,
}: ControlsProps): ReactElement => (
  <Box
    sx={{
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      bgcolor: 'background.paper',
      zIndex: (theme) => theme.custom.zIndex.stickyChrome,
      borderBottom: 1,
      borderColor: 'divider',
    }}
  >
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 1, py: 0.5 }}
    >
      <Typography variant="subtitle2">場面を検索</Typography>
      <IconButton size="small" aria-label="場面検索を閉じる" onClick={onClose}>
        <Close fontSize="small" />
      </IconButton>
    </Stack>
    <TextField
      label="行名・ラベル・ノートを検索"
      placeholder="Enterで先頭の場面へ"
      size="small"
      inputRef={inputRef}
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter' && results[0]) {
          event.preventDefault();
          onActivate(results[0].id);
        }
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="検索をクリア"
                onClick={() => {
                  onQueryChange('');
                  inputRef.current?.focus();
                }}
              >
                <Close fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
      sx={{ mx: 1, width: 'calc(100% - 16px)' }}
    />
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 1, py: 0.5 }}
    >
      <Typography variant="caption" role="status">
        {matchCount} / {totalCount} 件 · 時刻順
      </Typography>
      <Button size="small" disabled={!selectedItem} onClick={onFocusDetails}>
        詳細へ移動
      </Button>
    </Stack>
  </Box>
);
