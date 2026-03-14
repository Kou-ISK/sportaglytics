import React from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type {
  DashboardAnalysisMode,
  DashboardChartType,
  DashboardMetric,
} from '../../../../../../../types/Settings';

interface DashboardWidgetVisualizationSectionProps {
  analysisMode: DashboardAnalysisMode;
  setAnalysisMode: (value: DashboardAnalysisMode) => void;
  chartType: DashboardChartType;
  setChartType: (value: DashboardChartType) => void;
  metric: DashboardMetric;
  setMetric: (value: DashboardMetric) => void;
}

export const DashboardWidgetVisualizationSection = ({
  analysisMode,
  setAnalysisMode,
  chartType,
  setChartType,
  metric,
  setMetric,
}: DashboardWidgetVisualizationSectionProps) => {
  return (
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
        <FormControl fullWidth size="small">
          <InputLabel id="analysis-mode-label">分析モード</InputLabel>
          <Select
            labelId="analysis-mode-label"
            value={analysisMode}
            label="分析モード"
            onChange={(event) =>
              setAnalysisMode(event.target.value as DashboardAnalysisMode)
            }
          >
            <MenuItem value="standard">標準集計（軸/比較）</MenuItem>
            <MenuItem value="trend">トレンド（時系列）</MenuItem>
            <MenuItem value="histogram">ヒストグラム（分布）</MenuItem>
            <MenuItem value="rolling">ローリング（移動平均）</MenuItem>
            <MenuItem value="outlier">外れ値（IQR）</MenuItem>
          </Select>
        </FormControl>
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
              disabled={analysisMode !== 'standard'}
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
              onChange={(event) => setMetric(event.target.value as DashboardMetric)}
              disabled={analysisMode === 'outlier'}
            >
              <MenuItem value="count">件数</MenuItem>
              <MenuItem value="duration">所要時間</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        {analysisMode !== 'standard' && (
          <Typography variant="caption" color="text.secondary">
            高度分析モードではチャート種別はバーに固定されます。
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};
