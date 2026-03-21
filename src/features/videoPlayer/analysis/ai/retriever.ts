import type { EvidenceFilters, EvidenceItem } from './types';
import type { EvidenceIndex } from './evidenceIndex';
import { tokenizeQuery } from './evidenceIndex';
import { diversifyEvidence } from './retrieverDiversify';
import { resolveTeamContext } from './retrieverTeamContext';
import {
  matchesEvidenceLabelFilters,
  matchesEvidenceTimeRange,
  scoreEvidenceItem,
} from './retrieverScoring';

export type RetrieverWeights = {
  token: number;
  label: number;
  memo: number;
  time: number;
  rareLabel: number;
};

export type RetrieverDiversifyOptions = {
  maxEvidence?: number;
  ensureTop?: number;
  maxRare?: number;
  maxInsight?: number;
};

export interface RetrieverOptions {
  topK: number;
  timeRange?: EvidenceFilters['timeRange'];
  labelFilters?: EvidenceFilters['labelFilters'];
  weights?: Partial<RetrieverWeights>;
  diversify?: RetrieverDiversifyOptions;
  insightEvidenceIds?: string[];
}

interface Retriever {
  retrieve: (
    query: string,
    index: EvidenceIndex,
    options: RetrieverOptions,
  ) => EvidenceItem[];
}

const TEAM_SPLIT_REGEX = /[\s\u3000/／・\\\-–—_]+/;
const MIN_QUERY_TOKEN_LENGTH = 2;

const addToken = (set: Set<string>, value?: string | null) => {
  const token = (value ?? '').trim().toLowerCase();
  if (!token || token.length < MIN_QUERY_TOKEN_LENGTH) return;
  set.add(token);
};

const expandQueryTokens = (query: string, index: EvidenceIndex): Set<string> => {
  const tokens = tokenizeQuery(query);
  const normalizedQuery = query.toLowerCase();

  for (const actionName of index.actionFrequency.keys()) {
    if (!actionName) continue;
    const lower = actionName.toLowerCase();
    if (normalizedQuery.includes(lower)) {
      tokenizeQuery(actionName).forEach((token) => addToken(tokens, token));
    }
    const parts = actionName.split(TEAM_SPLIT_REGEX).map((part) => part.trim());
    for (const part of parts) {
      if (!part) continue;
      if (normalizedQuery.includes(part.toLowerCase())) {
        addToken(tokens, part);
      }
    }
  }

  for (const key of index.labelFrequency.keys()) {
    if (!key) continue;
    const lower = key.toLowerCase();
    if (normalizedQuery.includes(lower)) {
      addToken(tokens, key);
    }
    const split = key.split(':');
    const namePart = split.length > 1 ? split[1] : key;
    if (namePart && normalizedQuery.includes(namePart.toLowerCase())) {
      addToken(tokens, namePart);
    }
  }

  return tokens;
};

export class HybridEvidenceRetriever implements Retriever {
  retrieve(query: string, index: EvidenceIndex, options: RetrieverOptions): EvidenceItem[] {
    const queryTokens = expandQueryTokens(query, index);
    const teamContext = resolveTeamContext(query, index.items);
    const filtered = index.items.filter(
      (item) =>
        matchesEvidenceTimeRange(item, options.timeRange) &&
        matchesEvidenceLabelFilters(item, options.labelFilters),
    );

    let scored = filtered.map((item) => ({
      item,
      score: scoreEvidenceItem(
        item,
        queryTokens,
        query,
        options.timeRange,
        options.weights,
        index,
        teamContext,
      ),
    }));

    const hasSignal = scored.some((entry) => entry.score > 0);
    scored = scored.sort((a, b) => {
      if (!hasSignal) return b.item.startTime - a.item.startTime;
      if (b.score !== a.score) return b.score - a.score;
      return b.item.startTime - a.item.startTime;
    });

    return diversifyEvidence(scored, index, options, teamContext);
  }
}
