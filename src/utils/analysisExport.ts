import type { TimelineData } from '../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  getLabelByGroup,
  getLabelsFromTimelineData,
  extractUniqueTeams,
} from './labelExtractors';
import { buildEventInsights } from '../features/videoPlayer/analysis/utils/eventInsights';
import { createMomentumDataFactory } from '../features/videoPlayer/analysis/utils/momentum';
import { buildAnalysisReportData } from '../report/buildAnalysisReportData';
import type { AnalysisReportBuildContext } from '../report/types';

const toCsvCell = (value: string | number) => {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

const formatSeconds = (seconds: number, digits = 1) => {
  if (!Number.isFinite(seconds)) return '0.0';
  return Math.max(0, seconds).toFixed(digits);
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(Math.max(0, value) * 100).toFixed(1)}%`;
};

const formatTimecode = (seconds: number): string => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis
    .toString()
    .padStart(3, '0')}`;
};

const toSortedEntries = <T>(
  source: Map<string, T>,
  sorter: (a: T, b: T) => number,
) => Array.from(source.entries()).sort((a, b) => sorter(a[1], b[1]));

const joinValues = (values: Iterable<string>): string =>
  Array.from(values).filter(Boolean).join(' | ');

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

const collectLabelGroups = (timeline: TimelineData[]): string[] => {
  const groups = new Set<string>();
  timeline.forEach((entry) => {
    getLabelsFromTimelineData(entry).forEach((label) => {
      if (label.group) {
        groups.add(label.group);
      }
    });
  });

  const fixed = ['actionType', 'actionResult'];
  const extras = Array.from(groups)
    .filter((group) => !fixed.includes(group))
    .sort((a, b) => a.localeCompare(b));
  return [...fixed, ...extras];
};

export const exportRawAnalysisCsv = (timeline: TimelineData[]): string => {
  const labelGroups = collectLabelGroups(timeline);
  const headers = [
    'index',
    'id',
    'startSec',
    'endSec',
    'durationSec',
    'startTimecode',
    'endTimecode',
    'team',
    'action',
    'actionName',
    'memo',
    'color',
    'labelCount',
    'labels',
    ...labelGroups.map((group) => `label:${group}`),
  ];

  const rows: string[] = [headers.map(toCsvCell).join(',')];

  timeline.forEach((entry, index) => {
    const duration = Math.max(0, entry.endTime - entry.startTime);
    const labels = getLabelsFromTimelineData(entry);
    const labelByGroup = new Map<string, Set<string>>();

    labels.forEach((label) => {
      if (!label.group || !label.name) return;
      const bucket = labelByGroup.get(label.group) ?? new Set<string>();
      bucket.add(label.name);
      labelByGroup.set(label.group, bucket);
    });

    const labelText = labels
      .map((label) =>
        label.group ? `${label.group}:${label.name}` : (label.name ?? ''),
      )
      .filter(Boolean)
      .join(' | ');

    const row = [
      index + 1,
      entry.id,
      formatSeconds(entry.startTime, 3),
      formatSeconds(entry.endTime, 3),
      formatSeconds(duration, 3),
      formatTimecode(entry.startTime),
      formatTimecode(entry.endTime),
      extractTeamFromActionName(entry.actionName),
      extractActionFromActionName(entry.actionName),
      entry.actionName,
      entry.memo ?? '',
      entry.color ?? '',
      labels.length,
      labelText,
      ...labelGroups.map((group) => joinValues(labelByGroup.get(group) ?? [])),
    ];

    rows.push(row.map(toCsvCell).join(','));
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

export type AnalysisPdfTab = 'dashboard' | 'momentum' | 'matrix';

export interface AnalysisPdfImagePage {
  tab: AnalysisPdfTab;
  pageIndex: number;
  totalPages: number;
  dataUrl: string;
}

interface BuildAnalysisPdfHtmlOptions {
  summaryText: string;
  generatedAtIso: string;
  pages: AnalysisPdfImagePage[];
}

export const buildAnalysisPdfHtml = ({
  summaryText,
  generatedAtIso,
  pages,
}: BuildAnalysisPdfHtmlOptions): string => {
  const summaryHtml = escapeHtml(summaryText).replace(/\n/g, '<br />');
  const escapedGeneratedAt = escapeHtml(generatedAtIso);
  const tabLabelMap: Record<AnalysisPdfTab, string> = {
    dashboard: 'Dashboard',
    momentum: 'Momentum',
    matrix: 'Matrix',
  };

  const pageHtml = pages
    .map(
      (page) => `
      <section class="page image-page">
        <div class="header">
          <h1>${escapeHtml(tabLabelMap[page.tab])} ${page.pageIndex}/${page.totalPages}</h1>
          <p class="meta">Generated: ${escapedGeneratedAt}</p>
        </div>
        <div class="image-wrap">
          <img src="${page.dataUrl}" alt="${escapeHtml(tabLabelMap[page.tab])}" />
        </div>
      </section>
    `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>SporTagLytics Analysis Report</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        page-break-after: always;
      }

      .page:last-child {
        page-break-after: auto;
      }

      .header {
        margin-bottom: 10px;
      }

      .header h1 {
        margin: 0 0 4px;
        font-size: 20px;
      }

      .meta {
        margin: 0;
        font-size: 12px;
        color: #6b7280;
      }

      .summary {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 14px;
        font-size: 12px;
        line-height: 1.55;
        white-space: normal;
      }

      .image-page {
        display: flex;
        flex-direction: column;
        min-height: calc(297mm - 24mm);
      }

      .image-wrap {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        background: #ffffff;
      }

      .image-wrap img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        display: block;
      }
    </style>
  </head>
  <body>
    <section class="page">
      <div class="header">
        <h1>Analysis Summary</h1>
        <p class="meta">Generated: ${escapedGeneratedAt}</p>
      </div>
      <div class="summary">${summaryHtml}</div>
    </section>
    ${pageHtml}
  </body>
</html>`;
};

interface ExportAnalysisReportPdfOptions {
  reportContext: AnalysisReportBuildContext;
  defaultFileName?: string;
}

export const exportAnalysisReportPdf = async ({
  reportContext,
  defaultFileName,
}: ExportAnalysisReportPdfOptions): Promise<{
  success: boolean;
  canceled?: boolean;
}> => {
  const api = globalThis.window.electronAPI;
  if (!api?.saveFileDialog || !api?.printAnalysisReportPdf) {
    return { success: false };
  }

  const filePath = await api.saveFileDialog(
    defaultFileName ??
      `analysis-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    [{ name: 'PDF', extensions: ['pdf'] }],
  );
  if (!filePath) {
    return { success: false, canceled: true };
  }

  const reportData = buildAnalysisReportData(reportContext);
  const ok = await api.printAnalysisReportPdf(filePath, reportData);

  return { success: ok };
};
