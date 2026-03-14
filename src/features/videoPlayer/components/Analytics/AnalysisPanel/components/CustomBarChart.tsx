import React from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DASHBOARD_ENTRY_IDS_KEY,
  getDashboardEntryIdsKey,
  type CustomChartDatumValue,
} from '../controllers/useCustomChartData';

const SERIES_COLORS = [
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#0288d1',
  '#e64a19',
  '#689f38',
  '#c2185b',
  '#0097a7',
  '#d32f2f',
];

const normalizeKey = (value: string) =>
  value
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getSeriesColor = (key: string) => {
  const hash = Math.abs(
    key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
  );
  return SERIES_COLORS[hash % SERIES_COLORS.length];
};

interface CustomBarChartProps {
  data: Array<Record<string, CustomChartDatumValue>>;
  seriesKeys: string[];
  stacked: boolean;
  showLegend: boolean;
  unitLabel: string;
  height?: number;
  metric: 'count' | 'duration';
  calcMode?: 'raw' | 'percentTotal' | 'difference';
  teamColorMap?: Record<string, string>;
  onPointSelect?: (payload: { title: string; entryIds: string[] }) => void;
  disableAnimation?: boolean;
}

export const CustomBarChart = ({
  data,
  seriesKeys,
  stacked,
  showLegend,
  unitLabel,
  height = 280,
  metric,
  calcMode = 'raw',
  teamColorMap,
  onPointSelect,
  disableAnimation = false,
}: CustomBarChartProps) => {
  const theme = useTheme();
  const formatter = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${unitLabel}`;
    }
    return `${Math.round(value)}${unitLabel}`;
  };

  const normalizedSeriesKeys = seriesKeys.length > 0 ? seriesKeys : ['value'];
  const hasPerBarTeamColors =
    Boolean(teamColorMap) &&
    normalizedSeriesKeys.length === 1 &&
    data.some((entry) => Boolean(teamColorMap?.[String(entry.name ?? '')]));
  const rawUnitLabel = metric === 'duration' ? '秒' : '件';
  const formatRawValue = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${rawUnitLabel}`;
    }
    return `${Math.round(value)}${rawUnitLabel}`;
  };

  const tooltipStyles = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.primary,
    borderRadius: 6,
    padding: '8px 12px',
  } as const;

  const toEntryIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  };

  const resolveEntryIds = (
    payload: Record<string, CustomChartDatumValue>,
    seriesKey: string,
  ) => {
    const fromSeries = toEntryIds(payload[getDashboardEntryIdsKey(seriesKey)]);
    if (fromSeries.length > 0) return fromSeries;
    return toEntryIds(payload[DASHBOARD_ENTRY_IDS_KEY]);
  };

  const buildPointTitle = (name: string, seriesKey: string) => {
    if (normalizedSeriesKeys.length === 1 || seriesKey === 'value') {
      return name;
    }
    return `${name} / ${seriesKey}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis />
        <Tooltip
          formatter={(
            value: number | string | undefined,
            name: string | undefined,
            tooltipPayload: {
              payload?: Record<string, CustomChartDatumValue>;
            },
          ) => {
            const seriesName = name ?? '';
            const numericValue =
              typeof value === 'number' ? value : Number(value ?? 0);
            if (calcMode === 'percentTotal') {
              const payload = tooltipPayload?.payload ?? {};
              const rawKey = `__raw_${seriesName}`;
              const rawValue =
                typeof payload[rawKey] === 'number'
                  ? (payload[rawKey] as number)
                  : typeof payload.rawValue === 'number'
                    ? (payload.rawValue as number)
                    : undefined;
              if (typeof rawValue === 'number') {
                return [
                  `${numericValue.toFixed(1)}% (${formatRawValue(rawValue)})`,
                  seriesName,
                ];
              }
              return [`${numericValue.toFixed(1)}%`, seriesName];
            }
            return [formatter(numericValue), seriesName];
          }}
          contentStyle={tooltipStyles}
          labelStyle={{ color: theme.palette.text.secondary }}
          itemStyle={{ color: theme.palette.text.primary }}
          labelFormatter={(label) => String(label)}
        />
        {showLegend && <Legend />}
        {normalizedSeriesKeys.map((key) => {
          const fallbackFill = getSeriesColor(key);
          const fill = teamColorMap?.[normalizeKey(key)] ?? fallbackFill;
          return (
            <Bar
              key={key}
              dataKey={key}
              stackId={stacked ? 'stack' : undefined}
              fill={fill}
              isAnimationActive={!disableAnimation}
              radius={[4, 4, 0, 0]}
              cursor={onPointSelect ? 'pointer' : undefined}
              onClick={(event: {
                payload?: Record<string, CustomChartDatumValue>;
              }) => {
                if (!onPointSelect) return;
                const payload = event?.payload;
                if (!payload) return;
                const value = payload[key];
                if (typeof value === 'number' && value === 0) return;
                const entryIds = resolveEntryIds(payload, key);
                if (entryIds.length === 0) return;
                const name = String(payload.name ?? key);
                onPointSelect({
                  title: buildPointTitle(name, key),
                  entryIds,
                });
              }}
            >
              {hasPerBarTeamColors &&
                key === normalizedSeriesKeys[0] &&
                data.map((entry, index) => {
                  const entryName = String(entry.name ?? '');
                  const entryFill =
                    teamColorMap?.[normalizeKey(entryName)] ?? fill;
                  return (
                    <Cell key={`cell-${entryName}-${index}`} fill={entryFill} />
                  );
                })}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
};
