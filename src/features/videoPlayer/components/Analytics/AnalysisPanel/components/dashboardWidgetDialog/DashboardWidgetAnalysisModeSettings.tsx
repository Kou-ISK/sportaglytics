import React from 'react';
import { Stack, TextField, Typography } from '@mui/material';
import type { DashboardWidgetAnalysisModeSettingsProps } from './DashboardWidgetAxisSection.types';

const parseNumberOrEmpty = (value: string): number | '' => {
  const next = Number(value);
  return Number.isFinite(next) ? next : '';
};

export const DashboardWidgetAnalysisModeSettings = ({
  analysisMode,
  timeBucketSec,
  setTimeBucketSec,
  rollingWindow,
  setRollingWindow,
  histogramBinSec,
  setHistogramBinSec,
  outlierIqrMultiplier,
  setOutlierIqrMultiplier,
}: DashboardWidgetAnalysisModeSettingsProps) => {
  return (
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
            setTimeBucketSec(parseNumberOrEmpty(event.target.value));
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
            setRollingWindow(parseNumberOrEmpty(event.target.value));
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
            setHistogramBinSec(parseNumberOrEmpty(event.target.value));
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
            setOutlierIqrMultiplier(parseNumberOrEmpty(event.target.value));
          }}
          inputProps={{ min: 0.1, step: 0.1 }}
        />
      )}
    </Stack>
  );
};
