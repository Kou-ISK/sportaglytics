import React, { type ReactElement } from 'react';
import TimelineIcon from '@mui/icons-material/Timeline';
import PieChartIcon from '@mui/icons-material/PieChart';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import InsightsIcon from '@mui/icons-material/Insights';
import type { StatsView } from '../StatsModal';

export const TAB_DEFINITIONS: ReadonlyArray<{
  value: StatsView;
  label: string;
  icon: ReactElement;
}> = [
  {
    value: 'possession',
    label: 'ポゼッション',
    icon: <PieChartIcon fontSize="small" />,
  },
  {
    value: 'results',
    label: 'アクション結果',
    icon: <QueryStatsIcon fontSize="small" />,
  },
  {
    value: 'types',
    label: 'アクション種別',
    icon: <InsightsIcon fontSize="small" />,
  },
  {
    value: 'momentum',
    label: 'モメンタム',
    icon: <TimelineIcon fontSize="small" />,
  },
  {
    value: 'matrix',
    label: 'クロス集計',
    icon: <InsightsIcon fontSize="small" />,
  },
];

export const ACTIONS_TO_SUMMARISE: ReadonlyArray<string> = [
  'スクラム',
  'ラインアウト',
  'キック',
  'FK',
  'PK',
];
