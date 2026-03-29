import type { TimelineData } from '../../types/TimelineData';
import { getLabelsFromTimelineData } from '../../utils/labelExtractors';
import type { EvidenceFilters } from './aiTypes';
import { toLower } from './eventInsightsCommon';
import { buildEventInsightsResult } from './eventInsightsBuilders';
import type { EventInsights, InsightDimension } from './eventInsights.types';
import { resolveTeamInfo } from './eventInsightsTeamInfo';

export * from './eventInsights.types';
export { buildAiInsightFacts } from './eventInsightsAiFacts';

const matchesTimeRange = (
  item: TimelineData,
  range?: EvidenceFilters['timeRange'],
): boolean => {
  if (!range) return true;
  const start = range.start;
  const end = range.end;
  if (start != null && end != null) {
    return item.endTime >= start && item.startTime <= end;
  }
  if (start != null) {
    return item.endTime >= start;
  }
  if (end != null) {
    return item.startTime <= end;
  }
  return true;
};

const matchesLabelFilters = (
  item: TimelineData,
  filters?: EvidenceFilters['labelFilters'],
): boolean => {
  if (!filters || filters.length === 0) return true;
  const labels = getLabelsFromTimelineData(item);
  return filters.every((filter) => {
    if (!filter.group && !filter.name) return true;
    return labels.some((label) => {
      const groupMatch =
        !filter.group || toLower(label.group) === toLower(filter.group);
      const nameMatch =
        !filter.name || toLower(label.name) === toLower(filter.name);
      return groupMatch && nameMatch;
    });
  });
};

export const filterTimelineByEvidenceFilters = (
  timeline: TimelineData[],
  filters?: EvidenceFilters,
): TimelineData[] => {
  if (!filters) return timeline;
  return timeline.filter(
    (item) =>
      matchesTimeRange(item, filters.timeRange) &&
      matchesLabelFilters(item, filters.labelFilters),
  );
};

const sortTimeline = (timeline: TimelineData[]): TimelineData[] => {
  return [...timeline].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.endTime - b.endTime;
  });
};

export const buildEventInsights = (
  timeline: TimelineData[],
  config: {
    dimension: InsightDimension;
    topN?: number;
    sequenceLength?: number;
    sequenceLengths?: number[];
    teamGroup?: string;
    normalizeTeamActions?: boolean;
  },
): EventInsights => {
  const topN = Math.max(1, config.topN ?? 5);
  const sequenceLength = Math.max(2, config.sequenceLength ?? 3);
  const sequenceLengths = Array.from(
    new Set(
      (config.sequenceLengths && config.sequenceLengths.length > 0
        ? config.sequenceLengths
        : [sequenceLength]
      ).map((len) => Math.max(2, len)),
    ),
  );
  const ordered = sortTimeline(timeline);
  const teamInfo =
    config.dimension.type === 'action' && (config.normalizeTeamActions ?? true)
      ? resolveTeamInfo(ordered, config.teamGroup)
      : null;
  const normalizedTeamInfo =
    teamInfo && teamInfo.confidence >= 0.4
      ? { source: teamInfo.source, teams: teamInfo.teams }
      : undefined;

  return buildEventInsightsResult({
    ordered,
    dimension: config.dimension,
    topN,
    sequenceLength,
    sequenceLengths,
    normalizedTeamInfo,
  });
};
