import type { TimelineData } from '../../../../types/TimelineData';
import { getLabelsFromTimelineData } from '../../../../utils/labelExtractors';
import type { EvidenceItem } from './types';

export interface EvidenceIndexItem extends EvidenceItem {
  duration: number;
  normalizedText: string;
  tokenSet: Set<string>;
  labelTokenSet: Set<string>;
  memoTokenSet: Set<string>;
}

export interface EvidenceIndex {
  items: EvidenceIndexItem[];
  byId: Map<string, EvidenceIndexItem>;
  labelFrequency: Map<string, number>;
  actionFrequency: Map<string, number>;
  timeRange: {
    minStart: number;
    maxEnd: number;
  };
}

const TOKEN_SPLIT_REGEX = /[^\p{L}\p{N}]+/gu;

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .split(TOKEN_SPLIT_REGEX)
    .map((token) => token.trim())
    .filter(Boolean);
};

export const buildEvidenceIndex = (timeline: TimelineData[]): EvidenceIndex => {
  const labelFrequency = new Map<string, number>();
  const actionFrequency = new Map<string, number>();
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  const items: EvidenceIndexItem[] = [];

  for (const item of timeline) {
    const labels = getLabelsFromTimelineData(item);
    const labelText = labels
      .map((label) =>
        label.group ? `${label.group}:${label.name}` : label.name,
      )
      .join(' ')
      .trim();
    const memo = item.memo ?? '';
    const text = `${item.actionName} | ${labelText} | memo:${memo}`;
    const normalizedText = text.toLowerCase();
    const tokens = tokenize(`${item.actionName} ${labelText} ${memo}`);
    const labelTokens = tokenize(labelText);
    const memoTokens = tokenize(memo);
    const duration = Math.max(0, item.endTime - item.startTime);

    actionFrequency.set(
      item.actionName,
      (actionFrequency.get(item.actionName) ?? 0) + 1,
    );
    for (const label of labels) {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      labelFrequency.set(key, (labelFrequency.get(key) ?? 0) + 1);
    }
    minStart = Math.min(minStart, item.startTime);
    maxEnd = Math.max(maxEnd, item.endTime);

    items.push({
      id: item.id,
      actionName: item.actionName,
      startTime: item.startTime,
      endTime: item.endTime,
      memo,
      labels,
      text,
      normalizedText,
      duration,
      tokenSet: new Set(tokens),
      labelTokenSet: new Set(labelTokens),
      memoTokenSet: new Set(memoTokens),
    } satisfies EvidenceIndexItem);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    items,
    byId,
    labelFrequency,
    actionFrequency,
    timeRange: {
      minStart: Number.isFinite(minStart) ? minStart : 0,
      maxEnd: Number.isFinite(maxEnd) ? maxEnd : 0,
    },
  };
};

export const tokenizeQuery = (query: string): Set<string> => {
  return new Set(tokenize(query));
};
