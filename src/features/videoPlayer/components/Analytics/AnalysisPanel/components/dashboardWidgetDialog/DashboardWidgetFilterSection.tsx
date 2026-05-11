import React from 'react';
import {
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { DashboardSeriesFilter } from '../../../../../../../types/settings/coreTypes';

interface DashboardWidgetFilterSectionProps {
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  onResetFilters: () => void;
  widgetFilters: DashboardSeriesFilter;
  updateWidgetFilters: (patch: Partial<DashboardSeriesFilter>) => void;
  availableActions: string[];
  availableGroups: string[];
  availableLabelValues: Record<string, string[]>;
}

export const DashboardWidgetFilterSection = ({
  showFilters,
  setShowFilters,
  onResetFilters,
  widgetFilters,
  updateWidgetFilters,
  availableActions,
  availableGroups,
  availableLabelValues,
}: DashboardWidgetFilterSectionProps) => {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            5. 対象データ（絞り込み）
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showFilters}
                onChange={(event) => {
                  const next = event.target.checked;
                  setShowFilters(next);
                  if (!next) {
                    onResetFilters();
                  }
                }}
              />
            }
            label={showFilters ? '表示中' : '使わない'}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          チーム名はダッシュボードでは固定せず、必要に応じて全体フィルタで指定してください。
        </Typography>
        <Collapse in={showFilters}>
          <Stack spacing={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="widget-filter-action-label">
                アクション（actionName）
              </InputLabel>
              <Select
                labelId="widget-filter-action-label"
                value={widgetFilters.action ?? ''}
                label="アクション（actionName）"
                onChange={(event) =>
                  updateWidgetFilters({
                    action: event.target.value || undefined,
                  })
                }
              >
                <MenuItem value="">指定なし</MenuItem>
                {availableActions.map((action) => (
                  <MenuItem key={action} value={action}>
                    {action}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="widget-filter-group-label">
                  ラベルグループ
                </InputLabel>
                <Select
                  labelId="widget-filter-group-label"
                  value={widgetFilters.labelGroup ?? ''}
                  label="ラベルグループ"
                  onChange={(event) =>
                    updateWidgetFilters({
                      labelGroup: event.target.value || undefined,
                      labelValue: undefined,
                    })
                  }
                >
                  <MenuItem value="">指定なし</MenuItem>
                  {availableGroups.map((group) => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="widget-filter-value-label">ラベル値</InputLabel>
                <Select
                  labelId="widget-filter-value-label"
                  value={widgetFilters.labelValue ?? ''}
                  label="ラベル値"
                  onChange={(event) =>
                    updateWidgetFilters({
                      labelValue: event.target.value || undefined,
                    })
                  }
                  disabled={!widgetFilters.labelGroup}
                >
                  <MenuItem value="">指定なし</MenuItem>
                  {(
                    (widgetFilters.labelGroup &&
                      availableLabelValues[widgetFilters.labelGroup]) ||
                    []
                  ).map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
};
