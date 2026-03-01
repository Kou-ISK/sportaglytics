import React from 'react';
import {
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import { MatrixAxisSelector } from '../MatrixAxisSelector';

interface DashboardWidgetAxisSectionProps {
  analysisMode: DashboardAnalysisMode;
  dataMode: 'axis' | 'series';
  primaryAxis: MatrixAxisConfig;
  setPrimaryAxis: (value: MatrixAxisConfig) => void;
  availableGroups: string[];
  resolvedSeriesEnabled: boolean;
  setSeriesEnabled: (value: boolean) => void;
  chartType: DashboardChartType;
  seriesAxis: MatrixAxisConfig;
  setSeriesAxis: (value: MatrixAxisConfig) => void;
  calcMode: DashboardCalcMode;
  setCalcMode: (value: DashboardCalcMode) => void;
  addSeries: () => void;
  series: DashboardSeriesDefinition[];
  handleSeriesChange: (
    id: string,
    patch: Partial<DashboardSeriesDefinition>,
  ) => void;
  removeSeries: (id: string) => void;
  handleSeriesFilterChange: (
    id: string,
    patch: Partial<DashboardSeriesFilter>,
  ) => void;
  availableActions: string[];
  availableLabelValues: Record<string, string[]>;
  timeBucketSec: number | '';
  setTimeBucketSec: (value: number | '') => void;
  rollingWindow: number | '';
  setRollingWindow: (value: number | '') => void;
  histogramBinSec: number | '';
  setHistogramBinSec: (value: number | '') => void;
  outlierIqrMultiplier: number | '';
  setOutlierIqrMultiplier: (value: number | '') => void;
}

export const DashboardWidgetAxisSection = ({
  analysisMode,
  dataMode,
  primaryAxis,
  setPrimaryAxis,
  availableGroups,
  resolvedSeriesEnabled,
  setSeriesEnabled,
  chartType,
  seriesAxis,
  setSeriesAxis,
  calcMode,
  setCalcMode,
  addSeries,
  series,
  handleSeriesChange,
  removeSeries,
  handleSeriesFilterChange,
  availableActions,
  availableLabelValues,
  timeBucketSec,
  setTimeBucketSec,
  rollingWindow,
  setRollingWindow,
  histogramBinSec,
  setHistogramBinSec,
  outlierIqrMultiplier,
  setOutlierIqrMultiplier,
}: DashboardWidgetAxisSectionProps) => {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            3.{' '}
            {analysisMode === 'standard'
              ? dataMode === 'axis'
                ? '集計軸'
                : '比較シリーズ'
              : '分析モード設定'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {analysisMode === 'standard'
              ? dataMode === 'axis'
                ? 'X軸で分布を作り、必要なら色分けする軸を追加します。'
                : '条件ごとのシリーズを作って比較します。'
              : 'トレンド/分布/外れ値分析では、軸ではなく時系列・分布設定を使います。'}
          </Typography>
        </Stack>
        {analysisMode === 'standard' ? (
          <>
            {dataMode === 'axis' && (
              <>
                <MatrixAxisSelector
                  label="X軸"
                  value={primaryAxis}
                  onChange={setPrimaryAxis}
                  availableGroups={availableGroups}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={resolvedSeriesEnabled}
                      onChange={(event) => setSeriesEnabled(event.target.checked)}
                      disabled={chartType === 'stacked' || chartType === 'pie'}
                    />
                  }
                  label="系列（色分け）を使う"
                />

                {resolvedSeriesEnabled && chartType !== 'pie' && (
                  <MatrixAxisSelector
                    label="系列軸"
                    value={seriesAxis}
                    onChange={setSeriesAxis}
                    availableGroups={availableGroups}
                  />
                )}
              </>
            )}

            {dataMode === 'series' && (
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
                  <TextField size="small" disabled value="比較シリーズを追加してください" />
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
                          <InputLabel id={`${entry.id}-label-value`}>
                            ラベル値
                          </InputLabel>
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
            )}
          </>
        ) : (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              このモードでは軸設定・比較シリーズは使わず、時系列や分布の専用集計を実行します。
            </Typography>
            {(analysisMode === 'trend' || analysisMode === 'rolling') && (
              <TextField
                label="時間バケット（秒）"
                type="number"
                size="small"
                value={timeBucketSec}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTimeBucketSec(Number.isFinite(next) ? next : '');
                }}
                inputProps={{ min: 1, step: 1 }}
              />
            )}
            {analysisMode === 'rolling' && (
              <TextField
                label="移動平均ウィンドウ（バケット数）"
                type="number"
                size="small"
                value={rollingWindow}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRollingWindow(Number.isFinite(next) ? next : '');
                }}
                inputProps={{ min: 1, step: 1 }}
              />
            )}
            {analysisMode === 'histogram' && (
              <TextField
                label="ヒストグラムビン幅（秒）"
                type="number"
                size="small"
                value={histogramBinSec}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setHistogramBinSec(Number.isFinite(next) ? next : '');
                }}
                inputProps={{ min: 0.1, step: 0.1 }}
              />
            )}
            {analysisMode === 'outlier' && (
              <TextField
                label="外れ値閾値 IQR 係数"
                type="number"
                size="small"
                value={outlierIqrMultiplier}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setOutlierIqrMultiplier(Number.isFinite(next) ? next : '');
                }}
                inputProps={{ min: 0.1, step: 0.1 }}
              />
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};
