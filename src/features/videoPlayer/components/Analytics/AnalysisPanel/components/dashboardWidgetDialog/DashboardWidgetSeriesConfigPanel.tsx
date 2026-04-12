import React from 'react';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { DashboardCalcMode } from '../../../../../../../types/settings/coreTypes';
import type { DashboardWidgetSeriesConfigProps } from './DashboardWidgetAxisSection.types';

export const DashboardWidgetSeriesConfigPanel = ({
  calcMode,
  setCalcMode,
  addSeries,
  series,
  handleSeriesChange,
  removeSeries,
  handleSeriesFilterChange,
  availableActions,
  availableGroups,
  availableLabelValues,
}: DashboardWidgetSeriesConfigProps) => {
  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl fullWidth size="small">
          <InputLabel id="calc-mode-label">計算</InputLabel>
          <Select
            labelId="calc-mode-label"
            value={calcMode}
            label="計算"
            onChange={(event) =>
              setCalcMode(event.target.value as DashboardCalcMode)
            }
          >
            <MenuItem value="raw">実数</MenuItem>
            <MenuItem value="percentTotal">% of total</MenuItem>
            <MenuItem value="difference">差分</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={addSeries}>
          シリーズ追加
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        % of total は系列合計を100%として比率表示します。差分はシリーズ1-2です。
      </Typography>
      {calcMode === 'difference' && series.length !== 2 && (
        <TextField size="small" disabled value="差分はシリーズ2つ推奨" />
      )}

      {series.length === 0 && (
        <TextField
          size="small"
          disabled
          value="比較シリーズを追加してください"
        />
      )}

      {series.map((entry, index) => {
        const labelValues =
          entry.filters.labelGroup &&
          availableLabelValues[entry.filters.labelGroup]
            ? availableLabelValues[entry.filters.labelGroup]
            : [];
        return (
          <Stack
            key={entry.id}
            spacing={1.5}
            sx={{
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                label={`シリーズ${index + 1} 名`}
                value={entry.name}
                onChange={(event) =>
                  handleSeriesChange(entry.id, {
                    name: event.target.value,
                  })
                }
                fullWidth
              />
              <Button color="inherit" onClick={() => removeSeries(entry.id)}>
                削除
              </Button>
            </Stack>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id={`${entry.id}-action-label`}>
                  アクション（actionName）
                </InputLabel>
                <Select
                  labelId={`${entry.id}-action-label`}
                  value={entry.filters.action ?? ''}
                  label="アクション（actionName）"
                  onChange={(event) =>
                    handleSeriesFilterChange(entry.id, {
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
            </Stack>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id={`${entry.id}-label-group`}>
                  ラベルグループ
                </InputLabel>
                <Select
                  labelId={`${entry.id}-label-group`}
                  value={entry.filters.labelGroup ?? ''}
                  label="ラベルグループ"
                  onChange={(event) =>
                    handleSeriesFilterChange(entry.id, {
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
                <InputLabel id={`${entry.id}-label-value`}>ラベル値</InputLabel>
                <Select
                  labelId={`${entry.id}-label-value`}
                  value={entry.filters.labelValue ?? ''}
                  label="ラベル値"
                  onChange={(event) =>
                    handleSeriesFilterChange(entry.id, {
                      labelValue: event.target.value || undefined,
                    })
                  }
                  disabled={!entry.filters.labelGroup}
                >
                  <MenuItem value="">指定なし</MenuItem>
                  {labelValues.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        );
      })}
    </>
  );
};
