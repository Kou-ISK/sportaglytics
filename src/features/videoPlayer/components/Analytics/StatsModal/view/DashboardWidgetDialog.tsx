import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type {
  AnalysisDashboardWidget,
  DashboardChartType,
  DashboardMetric,
  DashboardCalcMode,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import { MatrixAxisSelector } from './MatrixAxisSelector';

interface DashboardWidgetDialogProps {
  open: boolean;
  availableGroups: string[];
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: Record<string, string[]>;
  initial?: AnalysisDashboardWidget | null;
  onSave: (widget: AnalysisDashboardWidget) => void;
  onClose: () => void;
}

const DEFAULT_PRIMARY_AXIS: MatrixAxisConfig = { type: 'team' };
const DEFAULT_SERIES_AXIS: MatrixAxisConfig = {
  type: 'group',
  value: 'all_labels',
};
const DEFAULT_WIDGET_FILTERS: DashboardSeriesFilter = {};

const generateWidgetId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const DashboardWidgetDialog = ({
  open,
  availableGroups,
  availableTeams,
  availableActions,
  availableLabelValues,
  initial,
  onSave,
  onClose,
}: DashboardWidgetDialogProps) => {
  const [title, setTitle] = useState('');
  const [chartType, setChartType] = useState<DashboardChartType>('bar');
  const [metric, setMetric] = useState<DashboardMetric>('count');
  const [primaryAxis, setPrimaryAxis] =
    useState<MatrixAxisConfig>(DEFAULT_PRIMARY_AXIS);
  const [seriesEnabled, setSeriesEnabled] = useState(false);
  const [seriesAxis, setSeriesAxis] =
    useState<MatrixAxisConfig>(DEFAULT_SERIES_AXIS);
  const [colSpan, setColSpan] = useState<4 | 6 | 12>(6);
  const [limit, setLimit] = useState<number | ''>('');
  const [dataMode, setDataMode] = useState<'axis' | 'series'>('axis');
  const [series, setSeries] = useState<DashboardSeriesDefinition[]>([]);
  const [calcMode, setCalcMode] = useState<DashboardCalcMode>('raw');
  const [widgetFilters, setWidgetFilters] =
    useState<DashboardSeriesFilter>(DEFAULT_WIDGET_FILTERS);

  useEffect(() => {
    if (!initial) {
      setTitle('');
      setChartType('bar');
      setMetric('count');
      setPrimaryAxis(DEFAULT_PRIMARY_AXIS);
      setSeriesEnabled(false);
      setSeriesAxis(DEFAULT_SERIES_AXIS);
      setColSpan(6);
      setLimit('');
      setDataMode('axis');
      setSeries([]);
      setCalcMode('raw');
      setWidgetFilters(DEFAULT_WIDGET_FILTERS);
      return;
    }
    setTitle(initial.title);
    setChartType(initial.chartType);
    setMetric(initial.metric);
    setPrimaryAxis(initial.primaryAxis);
    setSeriesEnabled(initial.seriesEnabled);
    setSeriesAxis(initial.seriesAxis);
    setColSpan(initial.colSpan);
    setLimit(initial.limit ?? '');
    setDataMode(initial.dataMode ?? 'axis');
    setSeries(initial.series ?? []);
    setCalcMode(initial.calc ?? 'raw');
    setWidgetFilters(initial.widgetFilters ?? DEFAULT_WIDGET_FILTERS);
  }, [initial, open]);

  const resolvedSeriesEnabled = useMemo(() => {
    if (chartType === 'stacked') return true;
    if (chartType === 'pie') return false;
    return seriesEnabled;
  }, [chartType, seriesEnabled]);

  useEffect(() => {
    if (dataMode === 'series' && series.length === 0) {
      addSeriesPair();
    }
  }, [dataMode, series.length]);

  const handleSave = () => {
    const resolvedTitle = title.trim() || 'カスタムチャート';
    const normalizedLimit =
      typeof limit === 'number' && limit > 0 ? limit : undefined;
    onSave({
      id: initial?.id ?? generateWidgetId(),
      title: resolvedTitle,
      chartType,
      metric,
      primaryAxis,
      seriesEnabled: resolvedSeriesEnabled,
      seriesAxis,
      colSpan,
      limit: normalizedLimit,
      dataMode,
      series,
      calc: calcMode,
      widgetFilters,
    });
  };

  const handleSeriesChange = (
    id: string,
    patch: Partial<DashboardSeriesDefinition>,
  ) => {
    setSeries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleSeriesFilterChange = (
    id: string,
    patch: Partial<DashboardSeriesFilter>,
  ) => {
    setSeries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, filters: { ...item.filters, ...patch } } : item,
      ),
    );
  };

  const addSeries = () => {
    setSeries((prev) => [
      ...prev,
      {
        id: generateWidgetId(),
        name: `シリーズ${prev.length + 1}`,
        filters: {},
      },
    ]);
  };

  const addSeriesPair = () => {
    setSeries((prev) => {
      const firstIndex = prev.length + 1;
      return [
        ...prev,
        {
          id: generateWidgetId(),
          name: `シリーズ${firstIndex}`,
          filters: {},
        },
        {
          id: generateWidgetId(),
          name: `シリーズ${firstIndex + 1}`,
          filters: {},
        },
      ];
    });
  };

  const removeSeries = (id: string) => {
    setSeries((prev) => prev.filter((item) => item.id !== id));
  };

  const updateWidgetFilters = (patch: Partial<DashboardSeriesFilter>) => {
    setWidgetFilters((prev) => ({ ...prev, ...patch }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initial ? 'ウィジェットを編集' : 'ウィジェットを追加'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            label="タイトル"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
            size="small"
          />

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="chart-type-label">チャート</InputLabel>
              <Select
                labelId="chart-type-label"
                value={chartType}
                label="チャート"
                onChange={(event) =>
                  setChartType(event.target.value as DashboardChartType)
                }
              >
                <MenuItem value="bar">バー</MenuItem>
                <MenuItem value="stacked">積み上げ</MenuItem>
                <MenuItem value="pie">円</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="metric-label">集計単位</InputLabel>
              <Select
                labelId="metric-label"
                value={metric}
                label="集計単位"
                onChange={(event) =>
                  setMetric(event.target.value as DashboardMetric)
                }
              >
                <MenuItem value="count">件数</MenuItem>
                <MenuItem value="duration">所要時間</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <FormControl fullWidth size="small">
            <InputLabel id="data-mode-label">データソース</InputLabel>
            <Select
              labelId="data-mode-label"
              value={dataMode}
              label="データソース"
              onChange={(event) =>
                setDataMode(event.target.value as 'axis' | 'series')
              }
            >
              <MenuItem value="axis">軸の集計</MenuItem>
              <MenuItem value="series">比較シリーズ</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="col-span-label">カード幅</InputLabel>
              <Select
                labelId="col-span-label"
                value={colSpan}
                label="カード幅"
                onChange={(event) =>
                  setColSpan(event.target.value as 4 | 6 | 12)
                }
              >
                <MenuItem value={4}>1/3</MenuItem>
                <MenuItem value={6}>1/2</MenuItem>
                <MenuItem value={12}>全幅</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="上位N件"
              type="number"
              size="small"
              value={limit}
              onChange={(event) => {
                const next = Number(event.target.value);
                setLimit(Number.isFinite(next) ? next : '');
              }}
              inputProps={{ min: 1, max: 50 }}
            />
          </Stack>

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
                {calcMode === 'difference' && series.length !== 2 && (
                  <TextField
                    size="small"
                    disabled
                    value="差分はシリーズ2つ推奨"
                  />
                )}
                <Button variant="outlined" onClick={addSeries}>
                  シリーズ追加
                </Button>
              </Stack>

              {series.length === 0 && (
                <TextField
                  size="small"
                  disabled
                  value="比較シリーズを追加してください"
                />
              )}

              {series.map((entry) => {
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
                        label="シリーズ名"
                        value={entry.name}
                        onChange={(event) =>
                          handleSeriesChange(entry.id, {
                            name: event.target.value,
                          })
                        }
                        fullWidth
                      />
                      <Button
                        color="inherit"
                        onClick={() => removeSeries(entry.id)}
                      >
                        削除
                      </Button>
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`${entry.id}-team-label`}>
                          チーム
                        </InputLabel>
                        <Select
                          labelId={`${entry.id}-team-label`}
                          value={entry.filters.team ?? ''}
                          label="チーム"
                          onChange={(event) =>
                            handleSeriesFilterChange(entry.id, {
                              team: event.target.value || undefined,
                            })
                          }
                        >
                          <MenuItem value="">指定なし</MenuItem>
                          {availableTeams.map((team) => (
                            <MenuItem key={team} value={team}>
                              {team}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`${entry.id}-action-label`}>
                          アクション
                        </InputLabel>
                        <Select
                          labelId={`${entry.id}-action-label`}
                          value={entry.filters.action ?? ''}
                          label="アクション"
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

          <Divider />
          <Stack spacing={1}>
            <TextField size="small" value="カード単位フィルタ" disabled />
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="widget-filter-team-label">チーム</InputLabel>
                <Select
                  labelId="widget-filter-team-label"
                  value={widgetFilters.team ?? ''}
                  label="チーム"
                  onChange={(event) =>
                    updateWidgetFilters({
                      team: event.target.value || undefined,
                    })
                  }
                >
                  <MenuItem value="">指定なし</MenuItem>
                  {availableTeams.map((team) => (
                    <MenuItem key={team} value={team}>
                      {team}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="widget-filter-action-label">
                  アクション
                </InputLabel>
                <Select
                  labelId="widget-filter-action-label"
                  value={widgetFilters.action ?? ''}
                  label="アクション"
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
            </Stack>
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
                <InputLabel id="widget-filter-value-label">
                  ラベル値
                </InputLabel>
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
                  {((widgetFilters.labelGroup &&
                    availableLabelValues[widgetFilters.labelGroup]) ||
                    []).map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
