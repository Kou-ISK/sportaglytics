import React, { useMemo } from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type {
  CreateMomentumDataFn,
  MomentumSegment,
} from '../../../../types/Analysis';

interface MomentumChartProps {
  createMomentumData: CreateMomentumDataFn;
  teamNames: string[];
}

interface MomentumChartDatum extends MomentumSegment {
  index: number;
  displayLabel: string;
}

interface LegendEntry {
  color: string;
  label: string;
}

// 凡例用のデータ（テーマ色を使用するため関数化）
const getLegendData = (theme: Theme): LegendEntry[] => [
  { color: theme.palette.momentum.try, label: 'Try' },
  { color: theme.palette.momentum.positive, label: 'Positive' },
  { color: theme.palette.momentum.negative, label: 'Negative' },
  { color: theme.palette.momentum.neutral, label: 'Neutral' },
];

// 凡例コンポーネント
const LegendComponent = ({ theme }: { theme: Theme }) => {
  const legendData = getLegendData(theme);

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      {legendData.map((item) => (
        <Stack key={item.label} direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: item.color,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

export const MomentumChart: React.FC<MomentumChartProps> = ({
  createMomentumData,
  teamNames,
}: MomentumChartProps) => {
  const theme = useTheme();
  const [teamA, teamB] = teamNames;

  const rawData: MomentumSegment[] = useMemo(() => {
    if (!teamA || !teamB) {
      return [];
    }
    return createMomentumData(teamA, teamB);
  }, [teamA, teamB, createMomentumData]);

  const chartData = useMemo(
    () =>
      rawData.map<MomentumChartDatum>((entry, index) => ({
        ...entry,
        index: index + 1,
        displayLabel: `${index + 1}. ${entry.teamName}`,
      })),
    [rawData],
  );

  const maxAbsValue = useMemo(() => {
    if (chartData.length === 0) return 10;
    const peak = Math.max(...chartData.map((item) => Math.abs(item.value)));
    if (!Number.isFinite(peak)) return 10;
    // ラベルのために余白を持たせる
    return Math.ceil((peak + 5) / 10) * 10;
  }, [chartData]);

  const getBarColor = (entry: MomentumSegment) => {
    // テーマ色を使用
    const { momentum } = theme.palette;

    // ポゼッションの終わり方によって異なる色を割り当て
    if (entry.outcome === 'Try') {
      return momentum.try;
    }
    if (entry.outcome === 'Positive') {
      return momentum.positive;
    }
    if (entry.outcome === 'Negative') {
      return momentum.negative;
    }
    return momentum.neutral;
  };

  const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
    active,
    payload,
  }) => {
    if (!active || !payload?.length) return null;
    const datum = payload[0]?.payload as MomentumChartDatum | undefined;
    if (!datum) return null;
    return (
      <Paper elevation={4} sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {datum.teamName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ポゼッション: {datum.possessionStart || '不明'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          結果: {datum.possessionResult || '不明'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          所要時間: {datum.absoluteValue.toFixed(1)} 秒
        </Typography>
      </Paper>
    );
  };

  if (chartData.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          モメンタムを計算するタイムラインがまだありません。
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          モメンタムチャート
        </Typography>
        <LegendComponent theme={theme} />
      </Box>

      <Typography variant="body2" color="text.secondary">
        中央線を境に左が {teamNames[0]}、右が {teamNames[1]}{' '}
        のポゼッションを表します。
      </Typography>

      <ResponsiveContainer height={420} width="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          barSize={18}
          margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[-maxAbsValue, maxAbsValue]}
            tickFormatter={(val) => `${Math.abs(val)}`}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            dataKey="displayLabel"
            type="category"
            width={160}
            tick={{ fontSize: 12 }}
          />
          <ReferenceLine x={0} stroke={theme.palette.divider} strokeWidth={2} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: theme.palette.action.hover }}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Stack>
  );
};
