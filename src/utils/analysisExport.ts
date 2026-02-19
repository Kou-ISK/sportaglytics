import type { TimelineData } from '../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
} from './labelExtractors';

const toCsvCell = (value: string | number) => {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0.0';
  return seconds.toFixed(1);
};

export const exportAnalysisCsv = (timeline: TimelineData[]): string => {
  const rows: string[] = [];
  rows.push(
    [
      'id',
      'startSec',
      'endSec',
      'durationSec',
      'team',
      'action',
      'actionName',
      'labels',
      'memo',
    ]
      .map(toCsvCell)
      .join(','),
  );

  timeline.forEach((entry) => {
    const duration = Math.max(0, entry.endTime - entry.startTime);
    const labels = (entry.labels ?? [])
      .map((label) => `${label.group}:${label.name}`)
      .join(' | ');
    rows.push(
      [
        entry.id,
        formatSeconds(entry.startTime),
        formatSeconds(entry.endTime),
        formatSeconds(duration),
        extractTeamFromActionName(entry.actionName),
        extractActionFromActionName(entry.actionName),
        entry.actionName,
        labels,
        entry.memo ?? '',
      ]
        .map(toCsvCell)
        .join(','),
    );
  });

  const teamAgg = new Map<string, { count: number; duration: number }>();
  const actionAgg = new Map<string, { count: number; duration: number }>();

  timeline.forEach((entry) => {
    const duration = Math.max(0, entry.endTime - entry.startTime);
    const team = extractTeamFromActionName(entry.actionName);
    const action = extractActionFromActionName(entry.actionName);

    const teamStat = teamAgg.get(team) ?? { count: 0, duration: 0 };
    teamStat.count += 1;
    teamStat.duration += duration;
    teamAgg.set(team, teamStat);

    const actionStat = actionAgg.get(action) ?? { count: 0, duration: 0 };
    actionStat.count += 1;
    actionStat.duration += duration;
    actionAgg.set(action, actionStat);
  });

  rows.push('');
  rows.push(toCsvCell('Aggregate by Team'));
  rows.push(['team', 'count', 'durationSec'].map(toCsvCell).join(','));
  Array.from(teamAgg.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([team, stat]) => {
      rows.push(
        [team, stat.count, formatSeconds(stat.duration)].map(toCsvCell).join(','),
      );
    });

  rows.push('');
  rows.push(toCsvCell('Aggregate by Action'));
  rows.push(['action', 'count', 'durationSec'].map(toCsvCell).join(','));
  Array.from(actionAgg.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([action, stat]) => {
      rows.push(
        [action, stat.count, formatSeconds(stat.duration)]
          .map(toCsvCell)
          .join(','),
      );
    });

  return rows.join('\n');
};

interface BuildSummaryOptions {
  view: string;
  timeline: TimelineData[];
  teamNames: string[];
}

export const buildAnalysisSummaryText = ({
  view,
  timeline,
  teamNames,
}: BuildSummaryOptions): string => {
  const total = timeline.length;
  const start = total > 0 ? Math.min(...timeline.map((item) => item.startTime)) : 0;
  const end = total > 0 ? Math.max(...timeline.map((item) => item.endTime)) : 0;
  const duration = Math.max(0, end - start);

  const actionAgg = new Map<string, number>();
  timeline.forEach((item) => {
    const action = extractActionFromActionName(item.actionName);
    actionAgg.set(action, (actionAgg.get(action) ?? 0) + 1);
  });
  const topActions = Array.from(actionAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const headerLines = [
    'SporTagLytics Analysis Summary',
    `View: ${view}`,
    `Events: ${total}`,
    `Window: ${formatSeconds(start)}s - ${formatSeconds(end)}s`,
    `Span: ${formatSeconds(duration)}s`,
    `Teams: ${teamNames.filter(Boolean).join(' / ') || '-'}`,
    '',
    'Top Actions',
  ];

  const actionLines =
    topActions.length > 0
      ? topActions.map(([action, count], index) => `${index + 1}. ${action}: ${count}`)
      : ['1. -'];

  return [...headerLines, ...actionLines].join('\n');
};
