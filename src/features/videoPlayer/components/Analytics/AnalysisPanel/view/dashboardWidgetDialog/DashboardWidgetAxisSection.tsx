import React from 'react';
import {
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { MatrixAxisSelector } from '../MatrixAxisSelector';
import { DashboardWidgetSeriesConfigPanel } from './DashboardWidgetSeriesConfigPanel';
import { DashboardWidgetAnalysisModeSettings } from './DashboardWidgetAnalysisModeSettings';
import type { DashboardWidgetAxisSectionProps } from './DashboardWidgetAxisSection.types';

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
              <DashboardWidgetSeriesConfigPanel
                calcMode={calcMode}
                setCalcMode={setCalcMode}
                addSeries={addSeries}
                series={series}
                handleSeriesChange={handleSeriesChange}
                removeSeries={removeSeries}
                handleSeriesFilterChange={handleSeriesFilterChange}
                availableActions={availableActions}
                availableGroups={availableGroups}
                availableLabelValues={availableLabelValues}
              />
            )}
          </>
        ) : (
          <DashboardWidgetAnalysisModeSettings
            analysisMode={analysisMode}
            timeBucketSec={timeBucketSec}
            setTimeBucketSec={setTimeBucketSec}
            rollingWindow={rollingWindow}
            setRollingWindow={setRollingWindow}
            histogramBinSec={histogramBinSec}
            setHistogramBinSec={setHistogramBinSec}
            outlierIqrMultiplier={outlierIqrMultiplier}
            setOutlierIqrMultiplier={setOutlierIqrMultiplier}
          />
        )}
      </Stack>
    </Paper>
  );
};
