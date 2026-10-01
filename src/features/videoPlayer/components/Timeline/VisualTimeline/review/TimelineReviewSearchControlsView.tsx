import type { ReactElement } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  Menu,
  MenuItem,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
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
  | 'page'
  | 'pageCount'
  | 'onPageChange'
  | 'actionsAnchor'
  | 'onOpenActions'
  | 'onCloseActions'
  | 'onRevealInTimeline'
  | 'onEdit'
  | 'onAddToPlaylist'
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
  page,
  pageCount,
  onPageChange,
  actionsAnchor,
  onOpenActions,
  onCloseActions,
  onRevealInTimeline,
  onEdit,
  onAddToPlaylist,
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
      spacing={0.75}
      sx={{
        px: 1,
        py: 0.5,
        minHeight: 40,
        '@container (max-width: 480px)': { flexWrap: 'wrap', gap: 0.5 },
      }}
    >
      <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
        場面検索
      </Typography>
      <TextField
        placeholder="行名・ラベル・ノート · Enterで移動"
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
          htmlInput: { 'aria-label': '行名・ラベル・ノートを検索' },
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
        sx={{
          flex: 1,
          minWidth: 120,
          '@container (max-width: 480px)': { order: 5, flexBasis: '100%' },
        }}
      />
      <Typography
        variant="caption"
        role="status"
        sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
      >
        {matchCount} / {totalCount} 件
      </Typography>
      {pageCount > 1 && (
        <Stack direction="row" alignItems="center" spacing={0}>
          <IconButton
            size="small"
            aria-label="前の40件"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            sx={{ minWidth: 32, textAlign: 'center' }}
          >
            {page + 1}/{pageCount}
          </Typography>
          <IconButton
            size="small"
            aria-label="次の40件"
            disabled={page + 1 === pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Stack>
      )}
      <Button
        size="small"
        disabled={!selectedItem}
        onClick={onFocusDetails}
        sx={{ minWidth: 48 }}
      >
        詳細へ移動
      </Button>
      <IconButton
        size="small"
        aria-label="場面の操作"
        disabled={!selectedItem}
        aria-haspopup="menu"
        aria-expanded={Boolean(actionsAnchor)}
        onClick={(event) => onOpenActions(event.currentTarget)}
      >
        <MoreHoriz fontSize="small" />
      </IconButton>
      <IconButton size="small" aria-label="場面検索を閉じる" onClick={onClose}>
        <Close fontSize="small" />
      </IconButton>
    </Stack>
    <Menu
      anchorEl={actionsAnchor}
      open={Boolean(actionsAnchor) && Boolean(selectedItem)}
      onClose={onCloseActions}
    >
      {selectedItem && onRevealInTimeline && (
        <MenuItem
          onClick={() => {
            onCloseActions();
            onRevealInTimeline(selectedItem.id);
          }}
        >
          Timelineで表示
        </MenuItem>
      )}
      {selectedItem && onEdit && (
        <MenuItem
          onClick={() => {
            onCloseActions();
            onEdit(selectedItem.id);
          }}
        >
          編集
        </MenuItem>
      )}
      {selectedItem && onAddToPlaylist && (
        <MenuItem
          onClick={() => {
            onCloseActions();
            onAddToPlaylist([selectedItem]);
          }}
        >
          Playlistに追加
        </MenuItem>
      )}
    </Menu>
  </Box>
);
