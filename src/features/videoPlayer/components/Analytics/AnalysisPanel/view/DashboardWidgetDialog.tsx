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
  Typography,
  Collapse,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
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
  const [quickAction, setQuickAction] = useState('');
  const [quickLabelGroup, setQuickLabelGroup] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      setQuickAction('');
      setQuickLabelGroup('');
      setShowTemplates(false);
      setShowFilters(true);
      setShowAdvanced(false);
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
    setQuickAction(initial.widgetFilters?.action ?? '');
    setQuickLabelGroup(initial.primaryAxis.value ?? '');
    setShowTemplates(false);
    setShowAdvanced(false);
    setShowFilters(
      Boolean(
        initial.widgetFilters?.team ||
          initial.widgetFilters?.action ||
          initial.widgetFilters?.labelGroup ||
          initial.widgetFilters?.labelValue,
      ),
    );
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

  const resolveDefaultGroup = (preferred: string) => {
    if (availableGroups.includes(preferred)) return preferred;
    if (availableGroups.length > 0) return availableGroups[0];
    return 'all_labels';
  };

  const getAxisLabel = (axis: MatrixAxisConfig) => {
    if (axis.type === 'team') return 'チーム';
    if (axis.type === 'action') return 'アクション(actionName)';
    if (axis.type !== 'group') return '未設定';
    if (axis.value === 'all_labels') return '全ラベル';
    return axis.value || 'ラベルグループ';
  };

  const getChartLabel = (type: DashboardChartType) => {
    if (type === 'bar') return 'バー';
    if (type === 'stacked') return '積み上げ';
    return '円';
  };

  const buildFilterSummary = (filters: DashboardSeriesFilter) => {
    const parts: string[] = [];
    if (filters.team) parts.push(`チーム=${filters.team}`);
    if (filters.action) parts.push(`アクション=${filters.action}`);
    if (filters.labelGroup) {
      const label = filters.labelValue
        ? `${filters.labelGroup}:${filters.labelValue}`
        : filters.labelGroup;
      parts.push(`ラベル=${label}`);
    }
    return parts;
  };

  const applyPreset = (mode: 'labelPie' | 'compareBar' | 'seriesPie') => {
    if (mode === 'labelPie') {
      setDataMode('axis');
      setChartType('pie');
      setMetric('count');
      setCalcMode('percentTotal');
      setSeriesEnabled(false);
      setPrimaryAxis({
        type: 'group',
        value: resolveDefaultGroup('actionResult'),
      });
      setShowFilters(true);
      if (!title.trim()) setTitle('ラベル比率');
      return;
    }
    if (mode === 'compareBar') {
      setDataMode('axis');
      setChartType('bar');
      setMetric('count');
      setCalcMode('raw');
      setSeriesEnabled(false);
      setPrimaryAxis({
        type: 'group',
        value: resolveDefaultGroup('actionType'),
      });
      setShowFilters(true);
      if (!title.trim()) setTitle('件数比較');
      return;
    }
    setDataMode('series');
    setChartType('pie');
    setMetric('count');
    setCalcMode('percentTotal');
    setShowFilters(true);
    if (series.length === 0) {
      setSeries([
        { id: generateWidgetId(), name: 'シリーズ1', filters: {} },
        { id: generateWidgetId(), name: 'シリーズ2', filters: {} },
      ]);
    }
    if (!title.trim()) setTitle('シリーズ比較');
  };

  const filterSummary = buildFilterSummary(widgetFilters);

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

  const handleQuickPieApply = () => {
    const labelGroup =
      quickLabelGroup || availableGroups[0] || 'all_labels';
    setDataMode('axis');
    setChartType('pie');
    setMetric('count');
    setCalcMode('percentTotal');
    setSeriesEnabled(false);
    setPrimaryAxis({ type: 'group', value: labelGroup });
    setWidgetFilters({
      action: quickAction || undefined,
      labelGroup: labelGroup || undefined,
      labelValue: undefined,
    });
    if (!title.trim()) {
      const parts = [quickAction, labelGroup].filter(Boolean);
      setTitle(parts.length ? `${parts.join(' ')} 比率` : 'ラベル比率');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initial ? 'ウィジェットを編集' : 'ウィジェットを追加'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                現在の設定
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                <Chip
                  label={`集計: ${dataMode === 'axis' ? '単一' : '比較'}`}
                  size="small"
                />
                <Chip label={`軸: ${getAxisLabel(primaryAxis)}`} size="small" />
                <Chip label={`チャート: ${getChartLabel(chartType)}`} size="small" />
                <Chip
                  label={`単位: ${metric === 'count' ? '件数' : '所要時間'}`}
                  size="small"
                />
                {filterSummary.length > 0 && (
                  <Chip
                    label={`絞り込み: ${filterSummary.join(' / ')}`}
                    size="small"
                  />
                )}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  1. 何を見たいか（テンプレート）
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  よく使う形を選んでから、必要に応じて詳細を調整します。
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => applyPreset('labelPie')}
                >
                  ラベル比率（円）
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => applyPreset('compareBar')}
                >
                  件数比較（バー）
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => applyPreset('seriesPie')}
                >
                  条件比較（円）
                </Button>
              </Stack>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  2. 基本設定
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  まずタイトルと、集計の考え方を決めます。
                </Typography>
              </Stack>
              <TextField
                label="タイトル"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                fullWidth
                size="small"
              />
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  単一集計は「カテゴリ別の分布」、比較シリーズは「条件同士の比較」です。
                </Typography>
                <ToggleButtonGroup
                  value={dataMode}
                  exclusive
                  onChange={(_event, value) => {
                    if (!value) return;
                    setDataMode(value as 'axis' | 'series');
                  }}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="axis">単一集計</ToggleButton>
                  <ToggleButton value="series">比較シリーズ</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  3. {dataMode === 'axis' ? '集計軸' : '比較シリーズ'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dataMode === 'axis'
                    ? 'X軸で分布を作り、必要なら色分けする軸を追加します。'
                    : '条件ごとのシリーズを作って比較します。'}
                </Typography>
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
                        onChange={(event) =>
                          setSeriesEnabled(event.target.checked)
                        }
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
                    <TextField
                      size="small"
                      disabled
                      value="差分はシリーズ2つ推奨"
                    />
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
                          <Button
                            color="inherit"
                            onClick={() => removeSeries(entry.id)}
                          >
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
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  4. 可視化
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  集計結果の見せ方と単位を選びます。
                </Typography>
              </Stack>
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
            </Stack>
          </Paper>

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
                          setWidgetFilters(DEFAULT_WIDGET_FILTERS);
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
              </Collapse>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  6. クイック設定
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showTemplates}
                      onChange={(event) =>
                        setShowTemplates(event.target.checked)
                      }
                    />
                  }
                  label={showTemplates ? '表示中' : '使わない'}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                よく使う円グラフをすぐ作成します（現在の入力を上書きします）。
              </Typography>
              <Collapse in={showTemplates}>
                <Stack spacing={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="quick-action-label">
                      アクション
                    </InputLabel>
                    <Select
                      labelId="quick-action-label"
                      value={quickAction}
                      label="アクション"
                      onChange={(event) =>
                        setQuickAction(event.target.value)
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
                  <Stack direction="row" spacing={2} alignItems="center">
                    <FormControl fullWidth size="small">
                      <InputLabel id="quick-label-group">
                        ラベルグループ
                      </InputLabel>
                      <Select
                        labelId="quick-label-group"
                        value={quickLabelGroup}
                        label="ラベルグループ"
                        onChange={(event) =>
                          setQuickLabelGroup(event.target.value)
                        }
                      >
                        {availableGroups.map((group) => (
                          <MenuItem key={group} value={group}>
                            {group}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button variant="outlined" onClick={handleQuickPieApply}>
                      適用
                    </Button>
                  </Stack>
                </Stack>
              </Collapse>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  7. 詳細設定
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showAdvanced}
                      onChange={(event) =>
                        setShowAdvanced(event.target.checked)
                      }
                    />
                  }
                  label={showAdvanced ? '表示中' : '使わない'}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                カードのサイズや上位件数の絞り込みを設定します。
              </Typography>
              <Collapse in={showAdvanced}>
                <Stack spacing={1.5}>
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
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
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
