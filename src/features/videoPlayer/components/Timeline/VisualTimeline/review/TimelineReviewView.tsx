import type { ReactElement, RefObject } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import type { TimelineData } from '../../../../../../types/timeline/core';

export interface TimelineReviewViewProps {
  open: boolean;
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  totalCount: number;
  matchCount: number;
  results: TimelineData[];
  selectedItem: TimelineData | null;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onToggle: () => void;
  onClose: () => void;
  onActivate: (id: string) => void;
  onEdit?: (id: string) => void;
  onAddToPlaylist?: (items: TimelineData[]) => void;
  formatTime: (seconds: number) => string;
}

export const TimelineReviewView = ({
  query,
  inputRef,
  totalCount,
  matchCount,
  results,
  selectedItem,
  page,
  pageCount,
  onPageChange,
  onQueryChange,
  onClose,
  onActivate,
  onEdit,
  onAddToPlaylist,
  formatTime,
}: TimelineReviewViewProps): ReactElement => (
  <Box
    component="aside"
    id="timeline-review"
    aria-label="場面を検索"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflowY: 'auto',
      bgcolor: 'background.paper',
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
      size="small"
      inputRef={inputRef}
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter' && results[0]) {
          event.preventDefault();
          onActivate(results[0].id);
          return;
        }
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        if (query) onQueryChange('');
        else onClose();
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
      sx={{ mx: 1 }}
    />
    <Typography variant="caption" role="status" sx={{ px: 1, py: 0.5 }}>
      {matchCount} / {totalCount} 件 · 時刻順 · Enterで先頭へ
    </Typography>
    <Box sx={{ flex: 1, minHeight: 64, overflowY: 'auto' }}>
      {results.length ? (
        <List dense disablePadding aria-label="場面検索の結果">
          {results.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                component="button"
                type="button"
                aria-pressed={selectedItem?.id === item.id}
                selected={selectedItem?.id === item.id}
                onClick={() => onActivate(item.id)}
                aria-label={`${item.actionName} ${formatTime(item.startTime)}へ移動`}
                sx={{
                  width: '100%',
                  textAlign: 'left',
                  alignItems: 'flex-start',
                  flexDirection: 'column',
                  borderBottom: 1,
                  borderColor: 'divider',
                  py: 0.75,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatTime(item.startTime)} – {formatTime(item.endTime)}
                </Typography>
                <Typography
                  variant="body2"
                  title={item.actionName}
                  noWrap
                  sx={{ width: '100%', fontWeight: 600 }}
                >
                  {item.actionName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ width: '100%' }}
                >
                  {item.memo ||
                    item.labels?.map((label) => label.name).join(' · ') ||
                    'ノートなし'}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <Stack spacing={1} sx={{ p: 2 }}>
          <Typography variant="body2">
            {totalCount ? '一致する場面がありません' : 'まだタグがありません'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalCount
              ? '検索語を短くするか、検索をクリアしてください。'
              : 'コードウィンドウでアクションを開始・終了すると、ここに場面が並びます。'}
          </Typography>
          {query && (
            <Button size="small" onClick={() => onQueryChange('')}>
              検索をクリア
            </Button>
          )}
        </Stack>
      )}
    </Box>
    {pageCount > 1 && (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1, borderTop: 1, borderColor: 'divider' }}
      >
        <Button
          size="small"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          前の40件
        </Button>
        <Typography variant="caption">
          {page + 1} / {pageCount}
        </Typography>
        <Button
          size="small"
          disabled={page + 1 === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          次の40件
        </Button>
      </Stack>
    )}
    <Box
      aria-label="選択した場面の詳細"
      role="region"
      tabIndex={0}
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        p: 1,
        maxHeight: '48%',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {selectedItem ? (
        <Stack spacing={0.75}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
          >
            {selectedItem.actionName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(selectedItem.startTime)} –{' '}
            {formatTime(selectedItem.endTime)}
          </Typography>
          <Stack direction="row" spacing={1}>
            {onEdit && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => onEdit(selectedItem.id)}
              >
                編集
              </Button>
            )}
            {onAddToPlaylist && (
              <Button
                size="small"
                onClick={() => onAddToPlaylist([selectedItem])}
              >
                Playlistに追加
              </Button>
            )}
          </Stack>
          {selectedItem.labels?.map((label, index) => (
            <Typography
              key={`${index}-${label.group}-${label.name}`}
              variant="caption"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {label.group}: {label.name}
            </Typography>
          ))}
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {selectedItem.memo || 'ノートなし'}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          結果をクリックまたはEnterで選ぶと、映像へ移動して詳細を表示します。
        </Typography>
      )}
    </Box>
  </Box>
);
