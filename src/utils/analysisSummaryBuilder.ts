import type { TimelineData } from '../types/timeline/core';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  extractUniqueTeams,
  getLabelByGroup,
} from './labelExtractors';
import { buildEventInsights } from '../shared/analysis/eventInsights';
import { createMomentumDataFactory } from '../shared/analysis/momentum';

const formatSeconds = (seconds: number, digits = 1) => {
  if (!Number.isFinite(seconds)) return '0.0';
  return Math.max(0, seconds).toFixed(digits);
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(Math.max(0, value) * 100).toFixed(1)}%`;
};

const toSortedEntries = <T>(
  source: Map<string, T>,
  sorter: (a: T, b: T) => number,
) => Array.from(source.entries()).sort((a, b) => sorter(a[1], b[1]));

const buildResolvedTeamNames = (
  timeline: TimelineData[],
  teamNames: string[],
): string[] => {
  const set = new Set<string>();
  teamNames.filter(Boolean).forEach((name) => set.add(name));
  extractUniqueTeams(timeline)
    .filter(Boolean)
    .forEach((name) => set.add(name));
  return Array.from(set);
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
  const minStart =
    total > 0 ? Math.min(...timeline.map((item) => item.startTime)) : 0;
  const maxEnd =
    total > 0 ? Math.max(...timeline.map((item) => item.endTime)) : 0;
  const span = total > 0 ? Math.max(0, maxEnd - minStart) : 0;
  const resolvedTeams = buildResolvedTeamNames(timeline, teamNames);

  const teamAgg = new Map<string, { count: number; duration: number }>();
  const actionAgg = new Map<string, number>();
  const resultAgg = new Map<string, number>();

  timeline.forEach((entry) => {
    const duration = Math.max(0, entry.endTime - entry.startTime);
    const team = extractTeamFromActionName(entry.actionName);
    const action = extractActionFromActionName(entry.actionName);
    const result = getLabelByGroup(entry, 'actionResult');

    const teamStat = teamAgg.get(team) ?? { count: 0, duration: 0 };
    teamStat.count += 1;
    teamStat.duration += duration;
    teamAgg.set(team, teamStat);

    actionAgg.set(action, (actionAgg.get(action) ?? 0) + 1);

    if (result) {
      resultAgg.set(result, (resultAgg.get(result) ?? 0) + 1);
    }
  });

  const teamLines = toSortedEntries(teamAgg, (a, b) => b.count - a.count).map(
    ([team, stat]) => {
      const share = total > 0 ? stat.count / total : 0;
      const avg = stat.count > 0 ? stat.duration / stat.count : 0;
      return `- ${team}: 件数 ${stat.count} (${formatPercent(share)}), 合計 ${formatSeconds(
        stat.duration,
      )}秒, 平均 ${formatSeconds(avg)}秒`;
    },
  );

  const actionLines = Array.from(actionAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([action, count], index) => `- ${index + 1}. ${action}: ${count}件`);

  const resultLines = Array.from(resultAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([result, count], index) => `- ${index + 1}. ${result}: ${count}件`);

  const flowLines =
    total >= 2
      ? buildEventInsights(timeline, {
          dimension: { type: 'action' },
          topN: 3,
        }).topTransitions.map(
          (transition, index) =>
            `- ${index + 1}. ${transition.from} -> ${transition.to}: ${transition.count}件 (確率 ${formatPercent(
              transition.probability,
            )})`,
        )
      : [];

  const [teamA, teamB] =
    resolvedTeams.length >= 2
      ? [resolvedTeams[0] as string, resolvedTeams[1] as string]
      : [resolvedTeams[0] || 'チームA', resolvedTeams[1] || 'チームB'];

  const momentumSegments = createMomentumDataFactory(timeline)(teamA, teamB);
  const momentumTotalDuration = momentumSegments.reduce(
    (sum, segment) => sum + segment.absoluteValue,
    0,
  );
  const momentumTeamAgg = new Map<
    string,
    { count: number; duration: number }
  >();
  const momentumOutcomeAgg = {
    Try: 0,
    Positive: 0,
    Negative: 0,
    Neutral: 0,
  };

  momentumSegments.forEach((segment) => {
    const stat = momentumTeamAgg.get(segment.teamName) ?? {
      count: 0,
      duration: 0,
    };
    stat.count += 1;
    stat.duration += segment.absoluteValue;
    momentumTeamAgg.set(segment.teamName, stat);

    if (segment.outcome === 'Try') momentumOutcomeAgg.Try += 1;
    else if (segment.outcome === 'Positive') momentumOutcomeAgg.Positive += 1;
    else if (segment.outcome === 'Negative') momentumOutcomeAgg.Negative += 1;
    else momentumOutcomeAgg.Neutral += 1;
  });

  const momentumLines =
    momentumSegments.length > 0
      ? [
          `- 対象ポゼッション: ${momentumSegments.length}件 / 合計 ${formatSeconds(
            momentumTotalDuration,
          )}秒`,
          ...Array.from(momentumTeamAgg.entries()).map(
            ([team, stat]) =>
              `- ${team}: ${stat.count}件 / 合計 ${formatSeconds(stat.duration)}秒`,
          ),
          `- Outcome: Try ${momentumOutcomeAgg.Try} / Positive ${momentumOutcomeAgg.Positive} / Negative ${momentumOutcomeAgg.Negative} / Neutral ${momentumOutcomeAgg.Neutral}`,
        ]
      : [];

  const section = (title: string, lines: string[]) => [
    `[${title}]`,
    ...(lines.length > 0 ? lines : ['- N/A']),
    '',
  ];

  const headerLines = [
    'SporTagLytics Analysis Summary',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  const overviewLines = [
    `- 表示ビュー: ${view}`,
    `- イベント数: ${total}`,
    `- 解析範囲: ${total > 0 ? `${formatSeconds(minStart)}s - ${formatSeconds(maxEnd)}s` : 'N/A'}`,
    `- スパン: ${total > 0 ? `${formatSeconds(span)}s` : 'N/A'}`,
    `- チーム: ${resolvedTeams.length > 0 ? resolvedTeams.join(' / ') : 'N/A'}`,
  ];

  return [
    ...headerLines,
    ...section('概要', overviewLines),
    ...section('チーム比較', teamLines),
    ...section('主要アクション', actionLines),
    ...section('主要結果', resultLines),
    ...section('フロー傾向', flowLines),
    ...section('モメンタム要約', momentumLines),
  ].join('\n');
};
