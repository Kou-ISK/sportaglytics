import type { TimelineData } from '../../types/timeline/core';
import { getLabelsFromTimelineData } from '../../utils/labelExtractors';
import type { InsightDimension } from './eventInsights.types';
import { normalizeActionNameForStats } from './eventInsightsTeamInfo';

export type NormalizedInsightTeamInfo = {
  source: 'label' | 'inferred';
  teams: string[];
};

export const toLower = (value?: string | null): string =>
  (value ?? '').toLowerCase();

export const resolveInsightState = (
  item: TimelineData,
  dimension: InsightDimension,
  teamInfo?: NormalizedInsightTeamInfo,
): string => {
  if (dimension.type === 'action') {
    return normalizeActionNameForStats(item.actionName, teamInfo);
  }

  const labels = getLabelsFromTimelineData(item);
  const target = labels.find(
    (label) => toLower(label.group) === toLower(dimension.group),
  );
  return target?.name?.trim() || '未設定';
};

export const safeInsightDuration = (item: TimelineData): number =>
  Math.max(0, item.endTime - item.startTime);

export const uniqueInsightIds = (ids: string[], limit = 5): string[] => {
  const result: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (!result.includes(id)) {
      result.push(id);
    }
    if (result.length >= limit) break;
  }
  return result;
};
