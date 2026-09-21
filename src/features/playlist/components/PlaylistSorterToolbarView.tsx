import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ViewColumn from '@mui/icons-material/ViewColumn';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import { SORTER_SORT_OPTIONS } from '../domain/playlistSorter';
import type { PlaylistSorterViewProps } from './PlaylistSorterView';

type Props = Pick<
  PlaylistSorterViewProps,
  'query' | 'sort' | 'columns' | 'onQueryChange' | 'onSort' | 'onToggleColumn'
>;
export const PlaylistSorterToolbarView = ({
  query,
  sort,
  columns,
  onQueryChange,
  onSort,
  onToggleColumn,
}: Props): ReactElement => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack
        direction="row"
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
        gap={0.75}
      >
        <TextField
          size="small"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="クリップを検索"
          slotProps={{ htmlInput: { 'aria-label': 'クリップを検索' } }}
          sx={{ flex: '1 1 180px', minWidth: 140 }}
        />
        <TextField
          select
          size="small"
          label="並べ替え"
          value={sort?.column ?? ''}
          sx={{ minWidth: 132 }}
          onChange={(event) => {
            const option = SORTER_SORT_OPTIONS.find(
              (entry) => entry.id === event.target.value,
            );
            if (option) onSort(option.id, sort?.direction ?? 'asc');
          }}
        >
          <MenuItem value="" disabled>
            項目を選択
          </MenuItem>
          {SORTER_SORT_OPTIONS.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          size="small"
          disabled={!sort}
          startIcon={<ArrowUpward />}
          aria-pressed={sort?.direction === 'asc'}
          onClick={() => sort && onSort(sort.column, 'asc')}
        >
          昇順
        </Button>
        <Button
          size="small"
          disabled={!sort}
          startIcon={<ArrowDownward />}
          aria-pressed={sort?.direction === 'desc'}
          onClick={() => sort && onSort(sort.column, 'desc')}
        >
          降順
        </Button>
        <Tooltip title="表示列">
          <IconButton
            size="small"
            aria-label="表示列"
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            <ViewColumn fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        ソートは全クリップの再生・書き出し順に反映されます。「元に戻す」で取り消せます。
      </Typography>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {columns
          .filter((column) => column.id !== 'index')
          .map((column) => (
            <MenuItem key={column.id} dense>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={column.visible}
                    onChange={() => onToggleColumn(column.id)}
                  />
                }
                label={column.label}
              />
            </MenuItem>
          ))}
      </Menu>
    </Box>
  );
};
