import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Popover,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FilterListIcon from '@mui/icons-material/FilterList';
import type { MatrixAxisConfig } from '../../../../../../types/analysis/matrix';

interface FilterSummaryBarProps {
  // 軸設定
  rowAxis: MatrixAxisConfig;
  columnAxis: MatrixAxisConfig;
  onRowAxisChange?: (config: MatrixAxisConfig) => void;
  onColumnAxisChange?: (config: MatrixAxisConfig) => void;
  renderAxisEditor?: (onClose: () => void) => React.ReactNode;

  // フィルター設定
  hasActiveFilters: boolean;
  filterCount: number;
  filterChips: Array<{ label: string; onDelete: () => void }>;
  renderFilterEditor?: (onClose: () => void) => React.ReactNode;

  // オプション
  showAxisSection?: boolean;
  showFilterSection?: boolean;
}

const getAxisLabel = (config: MatrixAxisConfig): string => {
  if (config.type === 'team') return 'チーム';
  if (config.type === 'action') return 'アクション';
  if (config.type === 'group') {
    if (config.value === 'all_labels') return '全てのラベル';
    return config.value || 'ラベルグループ';
  }
  return '';
};

export const FilterSummaryBar: React.FC<FilterSummaryBarProps> = ({
  rowAxis,
  columnAxis,
  renderAxisEditor,
  hasActiveFilters,
  filterCount,
  filterChips,
  renderFilterEditor,
  showAxisSection = true,
  showFilterSection = true,
}) => {
  const [axisAnchorEl, setAxisAnchorEl] = useState<HTMLElement | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  const handleAxisClick = (event: React.MouseEvent<HTMLElement>) => {
    setAxisAnchorEl(event.currentTarget);
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleAxisClose = () => {
    setAxisAnchorEl(null);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={0}>
        {/* 軸設定行 */}
        {showAxisSection && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 0.75,
              bgcolor: 'action.hover',
              borderBottom: showFilterSection ? '1px solid' : 'none',
              borderColor: 'divider',
              minHeight: 48,
            }}
          >
            <SettingsIcon
              fontSize="small"
              sx={{ mr: 1, color: 'text.secondary' }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 2 }}>
              軸:
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flex: 1, minWidth: 0, flexWrap: 'wrap' }}
            >
              <Chip
                label={`行: ${getAxisLabel(rowAxis)}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`列: ${getAxisLabel(columnAxis)}`}
                size="small"
                variant="outlined"
              />
            </Stack>
            {renderAxisEditor && (
              <Tooltip title="軸設定を変更">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SettingsIcon fontSize="small" />}
                  onClick={handleAxisClick}
                  aria-label="軸設定を変更"
                  sx={{ flexShrink: 0 }}
                >
                  軸を変更
                </Button>
              </Tooltip>
            )}
          </Box>
        )}

        {/* フィルター設定行 */}
        {showFilterSection && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 0.75,
              minHeight: 40,
            }}
          >
            <FilterListIcon
              fontSize="small"
              sx={{ mr: 1, color: 'text.secondary' }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 2 }}>
              フィルタ:
            </Typography>
            {hasActiveFilters && (
              <Chip
                size="small"
                variant="outlined"
                color="primary"
                label={`${filterCount}件`}
                sx={{ mr: 1 }}
              />
            )}
            {hasActiveFilters ? (
              <Stack
                direction="row"
                spacing={1}
                sx={{ flex: 1, minWidth: 0, flexWrap: 'wrap' }}
              >
                {filterChips.map((chip, index) => (
                  <Chip
                    key={index}
                    label={chip.label}
                    size="small"
                    color="primary"
                    onDelete={chip.onDelete}
                  />
                ))}
              </Stack>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1 }}
              >
                なし
              </Typography>
            )}
            {renderFilterEditor && (
              <Tooltip
                title={hasActiveFilters ? 'フィルタを編集' : 'フィルタを追加'}
              >
                <Button
                  size="small"
                  variant={hasActiveFilters ? 'contained' : 'outlined'}
                  startIcon={<FilterListIcon fontSize="small" />}
                  onClick={handleFilterClick}
                  aria-label={
                    hasActiveFilters ? 'フィルタを編集' : 'フィルタを追加'
                  }
                  sx={{ flexShrink: 0 }}
                >
                  {hasActiveFilters ? 'フィルタを編集' : 'フィルタを追加'}
                </Button>
              </Tooltip>
            )}
          </Box>
        )}
      </Stack>

      {/* 軸設定Popover */}
      {renderAxisEditor && (
        <Popover
          open={Boolean(axisAnchorEl)}
          anchorEl={axisAnchorEl}
          onClose={handleAxisClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              p: 2,
              width: { xs: 'calc(100vw - 32px)', sm: 560 },
              maxWidth: 'calc(100vw - 32px)',
            },
          }}
        >
          <Stack spacing={1.5}>
            {renderAxisEditor(handleAxisClose)}
            <Box display="flex" justifyContent="flex-end">
              <Button size="small" variant="outlined" onClick={handleAxisClose}>
                閉じる
              </Button>
            </Box>
          </Stack>
        </Popover>
      )}

      {/* フィルター設定Popover */}
      {renderFilterEditor && (
        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={handleFilterClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              p: 2,
              width: { xs: 'calc(100vw - 32px)', md: 720 },
              maxWidth: 'calc(100vw - 32px)',
            },
          }}
        >
          <Stack spacing={1.5}>
            {renderFilterEditor(handleFilterClose)}
          </Stack>
        </Popover>
      )}
    </Box>
  );
};
