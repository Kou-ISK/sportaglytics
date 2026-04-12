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
} from '../../../../types/analysis/momentum';

interface MomentumChartProps {
  createMomentumData: CreateMomentumDataFn;
  teamNames: string[];
  onPointSelect?: (payload: { title: string; entryIds: string[] }) => void;
  disableAnimation?: boolean;
  renderMode?: 'screen' | 'print';
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
  onPointSelect,
  disableAnimation = false,
  renderMode = 'screen',
}: MomentumChartProps) => {
  const isPrint = renderMode === 'print';
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
  const yAxisWidth = isPrint ? 124 : 160;
  const chartMarginLeft = isPrint ? 12 : 24;
  const chartMarginRight = chartMarginLeft + yAxisWidth;
  const xAxisTicks = useMemo(() => {
    if (isPrint) return undefined;
    return [-maxAbsValue, 0, maxAbsValue];
  }, [isPrint, maxAbsValue]);

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

  const CustomTooltip: React.FC<
    TooltipProps<number, string> & {
      payload?: Array<{ payload?: MomentumChartDatum }>;
    }
  > = ({ active, payload }) => {
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
    <Stack spacing={isPrint ? 1 : 2}>
      <Box display="flex" alignItems="center" justifyContent="flex-end">
        <LegendComponent theme={theme} />
      </Box>

      <Typography variant="body2" color="text.secondary">
        中央線を境に左が {teamNames[0]}、右が {teamNames[1]}{' '}
        のポゼッションを表します。
      </Typography>

      <ResponsiveContainer height={isPrint ? 340 : 420} width="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          barSize={isPrint ? 14 : 18}
          margin={{
            top: isPrint ? 8 : 10,
            right: chartMarginRight,
            bottom: isPrint ? 8 : 10,
            left: chartMarginLeft,
          }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[-maxAbsValue, maxAbsValue]}
            ticks={xAxisTicks}
            tickFormatter={(val) => `${Math.abs(val)}`}
            tick={{ fontSize: isPrint ? 10 : 12 }}
          />
          <YAxis
            dataKey="displayLabel"
            type="category"
            width={yAxisWidth}
            tick={{ fontSize: isPrint ? 10 : 12 }}
          />
          <ReferenceLine x={0} stroke={theme.palette.divider} strokeWidth={2} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: theme.palette.action.hover }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 4, 4]}
            isAnimationActive={!disableAnimation}
            onClick={(event: { payload?: MomentumChartDatum }) => {
              const datum = event?.payload;
              if (!datum?.entryId) return;
              onPointSelect?.({
                title: `${datum.teamName} ${datum.possessionStart} (${datum.possessionResult})`,
                entryIds: [datum.entryId],
              });
            }}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Stack>
  );
};
