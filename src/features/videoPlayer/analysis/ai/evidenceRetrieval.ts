import type { TimelineData } from '../../../../types/TimelineData';
import { getLabelsFromTimelineData } from '../../../../utils/labelExtractors';
import { cosineSimilarity, type EmbeddingProvider } from './embeddings';
import type { EvidenceFilters, EvidenceItem } from './types';

const TOKEN_SPLIT_REGEX = /[^\p{L}\p{N}]+/gu;

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .split(TOKEN_SPLIT_REGEX)
    .map((token) => token.trim())
    .filter(Boolean);
};

interface EvidenceIndexItem extends EvidenceItem {
  tokenSet: Set<string>;
  labelTokenSet: Set<string>;
  memoTokenSet: Set<string>;
}

export interface EvidenceIndex {
  items: EvidenceIndexItem[];
}

export const buildEvidenceIndex = (timeline: TimelineData[]): EvidenceIndex => {
  const items = timeline.map((item) => {
    const labels = getLabelsFromTimelineData(item);
    const labelText = labels
      .map((label) => `${label.group ?? ''}:${label.name}`)
      .join(',');
    const memo = item.memo ?? '';
    const text = `${item.actionName} | ${labelText} | memo:${memo}`;
    const tokens = tokenize(`${item.actionName} ${labelText} ${memo}`);
    const labelTokens = tokenize(labelText);
    const memoTokens = tokenize(memo);
    return {
      id: item.id,
      actionName: item.actionName,
      startTime: item.startTime,
      endTime: item.endTime,
      memo,
      labels,
      text,
      tokenSet: new Set(tokens),
      labelTokenSet: new Set(labelTokens),
      memoTokenSet: new Set(memoTokens),
    };
  });

  return { items };
};

export interface EvidenceRetrievalResult {
  items: EvidenceItem[];
  scores: Map<string, number>;
}

const matchesTimeRange = (
  item: EvidenceIndexItem,
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
  item: EvidenceIndexItem,
  filters?: EvidenceFilters['labelFilters'],
): boolean => {
  if (!filters || filters.length === 0) return true;
  return filters.every((filter) => {
    if (!filter.group && !filter.name) return true;
    return item.labels.some((label) => {
      const groupMatch =
        !filter.group ||
        (label.group ?? '').toLowerCase() === filter.group.toLowerCase();
      const nameMatch = !filter.name || label.name === filter.name;
      return groupMatch && nameMatch;
    });
  });
};

const scoreItem = (item: EvidenceIndexItem, queryTokens: Set<string>) => {
  if (queryTokens.size === 0) return 0;
  let tokenScore = 0;
  let labelBonus = 0;
  let memoBonus = 0;

  for (const token of queryTokens) {
    if (item.tokenSet.has(token)) tokenScore += 1;
    if (item.labelTokenSet.has(token)) labelBonus += 1;
    if (item.memoTokenSet.has(token)) memoBonus += 1;
  }

  return tokenScore + labelBonus * 2 + memoBonus;
};

const rerankWithEmbeddings = async (
  scoredItems: Array<{ item: EvidenceIndexItem; score: number }>,
  query: string,
  provider?: EmbeddingProvider,
) => {
  if (!provider || !provider.isEnabled()) return scoredItems;
  try {
    const texts = [query, ...scoredItems.map((entry) => entry.item.text)];
    const vectors = await provider.embed(texts);
    if (!vectors || vectors.length !== texts.length) return scoredItems;
    const [queryVector, ...itemVectors] = vectors;
    return scoredItems
      .map((entry, index) => {
        const similarity = cosineSimilarity(queryVector, itemVectors[index]);
        return { ...entry, score: entry.score + similarity * 2 };
      })
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    console.debug('[AI] Embedding rerank skipped:', error);
    return scoredItems;
  }
};

export const retrieveEvidence = async (
  index: EvidenceIndex,
  query: string,
  filters: EvidenceFilters,
  topK: number,
  embeddingProvider?: EmbeddingProvider,
): Promise<EvidenceRetrievalResult> => {
  const queryTokens = new Set(tokenize(query));

  const filtered = index.items.filter(
    (item) => matchesTimeRange(item, filters.timeRange) &&
      matchesLabelFilters(item, filters.labelFilters),
  );

  let scored = filtered.map((item) => ({
    item,
    score: scoreItem(item, queryTokens),
  }));

  if (queryTokens.size === 0) {
    scored = scored.sort((a, b) => b.item.startTime - a.item.startTime);
  } else {
    scored = scored.sort((a, b) => b.score - a.score);
    scored = await rerankWithEmbeddings(scored, query, embeddingProvider);
  }

  const limited = scored.slice(0, Math.max(1, topK));
  const scores = new Map<string, number>();
  const items = limited.map((entry) => {
    scores.set(entry.item.id, entry.score);
    return entry.item;
  });

  return { items, scores };
};
