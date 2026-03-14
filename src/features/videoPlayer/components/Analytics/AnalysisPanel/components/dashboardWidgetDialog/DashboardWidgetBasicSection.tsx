import React from 'react';
import { Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { DashboardAnalysisMode } from '../../../../../../../types/Settings';

interface DashboardWidgetBasicSectionProps {
  title: string;
  setTitle: (value: string) => void;
  dataMode: 'axis' | 'series';
  setDataMode: (value: 'axis' | 'series') => void;
  analysisMode: DashboardAnalysisMode;
}

export const DashboardWidgetBasicSection = ({
  title,
  setTitle,
  dataMode,
  setDataMode,
  analysisMode,
}: DashboardWidgetBasicSectionProps) => {
  return (
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
            disabled={analysisMode !== 'standard'}
          >
            <ToggleButton value="axis">単一集計</ToggleButton>
            <ToggleButton value="series">比較シリーズ</ToggleButton>
          </ToggleButtonGroup>
          {analysisMode !== 'standard' && (
            <Typography variant="caption" color="text.secondary">
              高度分析モードでは単一集計で固定されます。
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};
