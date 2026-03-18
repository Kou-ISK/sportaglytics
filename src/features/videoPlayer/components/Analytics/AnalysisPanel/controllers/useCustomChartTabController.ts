import { useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { TimelineData } from '../../../../../../types/TimelineData';
import {
  extractUniqueGroups,
  extractUniqueTeams,
} from '../../../../../../utils/labelExtractors';
import { getTimelineTeamOrder } from '../../../../../../utils/teamOrder';
import { buildCustomChartData } from './useCustomChartData';
import type {
  CustomChartTabViewProps,
  MetricType,
} from '../components/CustomChartTabView';

interface CustomChartTabControllerParams {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
}

const DEFAULT_PRIMARY_AXIS: MatrixAxisConfig = { type: 'team' };
const DEFAULT_SERIES_AXIS: MatrixAxisConfig = {
  type: 'group',
  value: 'all_labels',
};

export const useCustomChartTabController = ({
  hasData,
  timeline,
  emptyMessage,
}: CustomChartTabControllerParams): CustomChartTabViewProps => {
  const theme = useTheme();
  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );
  const availableTeams = useMemo(
    () => extractUniqueTeams(timeline),
    [timeline],
  );
  const orderedTeams = useMemo(() => {
    const fromTimeline = getTimelineTeamOrder(timeline).filter(Boolean);
    return fromTimeline.length > 0 ? fromTimeline : availableTeams;
  }, [availableTeams, timeline]);
  const teamColorMap = useMemo(() => {
    const map: Record<string, string> = {
      Team1: theme.palette.team1.main,
      Team2: theme.palette.team2.main,
    };
    if (orderedTeams[0]) {
      map[orderedTeams[0]] = theme.palette.team1.main;
    }
    if (orderedTeams[1]) {
      map[orderedTeams[1]] = theme.palette.team2.main;
    }
    return map;
  }, [orderedTeams, theme.palette.team1.main, theme.palette.team2.main]);

  const [primaryAxis, setPrimaryAxis] = useState<MatrixAxisConfig>(
    DEFAULT_PRIMARY_AXIS,
  );
  const [seriesEnabled, setSeriesEnabled] = useState(false);
  const [seriesAxis, setSeriesAxis] = useState<MatrixAxisConfig>(
    DEFAULT_SERIES_AXIS,
  );
  const [metric, setMetric] = useState<MetricType>('count');

  const chartState = useMemo(
    () =>
      buildCustomChartData(timeline, availableGroups, {
        primaryAxis,
        seriesAxis,
        seriesEnabled,
        metric,
      }),
    [availableGroups, metric, primaryAxis, seriesAxis, seriesEnabled, timeline],
  );

  return {
    hasData,
    emptyMessage,
    timelineCount: timeline.length,
    availableGroups,
    teamColorMap,
    primaryAxis,
    seriesEnabled,
    seriesAxis,
    metric,
    chartState,
    onPrimaryAxisChange: setPrimaryAxis,
    onSeriesEnabledChange: setSeriesEnabled,
    onSeriesAxisChange: setSeriesAxis,
    onMetricChange: setMetric,
  };
};
