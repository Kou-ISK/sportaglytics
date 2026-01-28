import type { TimelineData } from '../../../../types/TimelineData';
import { getLabelsFromTimelineData } from '../../../../utils/labelExtractors';
import type { EvidenceItem } from './types';

export interface EvidenceIndexItem extends EvidenceItem {
  duration: number;
  tokenSet: Set<string>;
  labelTokenSet: Set<string>;
  memoTokenSet: Set<string>;
}

export interface EvidenceIndex {
  items: EvidenceIndexItem[];
  byId: Map<string, EvidenceIndexItem>;
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
  const items = timeline.map((item) => {
    const labels = getLabelsFromTimelineData(item);
    const labelText = labels
      .map((label) =>
        label.group ? `${label.group}:${label.name}` : label.name,
      )
      .join(' ')
      .trim();
    const memo = item.memo ?? '';
    const text = `${item.actionName} | ${labelText} | memo:${memo}`;
    const tokens = tokenize(`${item.actionName} ${labelText} ${memo}`);
    const labelTokens = tokenize(labelText);
    const memoTokens = tokenize(memo);
    const duration = Math.max(0, item.endTime - item.startTime);

    return {
      id: item.id,
      actionName: item.actionName,
      startTime: item.startTime,
      endTime: item.endTime,
      memo,
      labels,
      text,
      duration,
      tokenSet: new Set(tokens),
      labelTokenSet: new Set(labelTokens),
      memoTokenSet: new Set(memoTokens),
    } satisfies EvidenceIndexItem;
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  return { items, byId };
};

export const tokenizeQuery = (query: string): Set<string> => {
  return new Set(tokenize(query));
};
