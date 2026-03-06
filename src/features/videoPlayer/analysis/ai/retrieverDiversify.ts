import type { EvidenceItem } from './types';
import type { EvidenceIndex, EvidenceIndexItem } from './evidenceIndex';
import type { RetrieverDiversifyOptions, RetrieverOptions } from './retriever';
import type { TeamContext } from './retrieverTeamContext';

type ScoredEvidence = {
  item: EvidenceIndexItem;
  score: number;
};

const DEFAULT_DIVERSIFY: Required<RetrieverDiversifyOptions> = {
  maxEvidence: 30,
  ensureTop: 6,
  maxRare: 4,
  maxInsight: 6,
};

const pickDurationExtremes = (items: EvidenceIndexItem[]) => {
  if (items.length === 0) return { shortest: null, longest: null, median: null };
  const durations = items.map((item) => item.duration).sort((a, b) => a - b);
  const medianValue = durations[Math.floor(durations.length / 2)];
  let medianItem = items[0];
  let shortest = items[0];
  let longest = items[0];
  for (const item of items) {
    if (item.duration < shortest.duration) shortest = item;
    if (item.duration > longest.duration) longest = item;
    if (
      Math.abs(item.duration - medianValue) <
      Math.abs(medianItem.duration - medianValue)
    ) {
      medianItem = item;
    }
  }
  return { shortest, longest, median: medianItem };
};

const selectRareLabelItems = (
  items: EvidenceIndexItem[],
  index: EvidenceIndex,
  scoredMap: Map<string, number>,
  limit: number,
): EvidenceIndexItem[] => {
  if (items.length === 0) return [];
  const threshold = Math.max(1, Math.ceil(index.items.length * 0.05));
  const rare = items.filter((item) =>
    item.labels.some((label) => {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      const count = index.labelFrequency.get(key) ?? 0;
      return count > 0 && count <= threshold;
    }),
  );
  rare.sort((a, b) => (scoredMap.get(b.id) ?? 0) - (scoredMap.get(a.id) ?? 0));
  return rare.slice(0, limit);
};

const computeTargetCount = (selectedCount: number, requested: number): number => {
  const capped = Math.min(Math.max(1, requested), 30);
  return Math.min(Math.max(capped, selectedCount), 30);
};

export const diversifyEvidence = (
  scored: ScoredEvidence[],
  index: EvidenceIndex,
  options: RetrieverOptions,
  teamContext?: TeamContext | null,
): EvidenceItem[] => {
  const topK = Math.max(1, options.topK);
  const candidates = scored.slice(0, topK).map((entry) => entry.item);
  const scoredMap = new Map(scored.map((entry) => [entry.item.id, entry.score]));
  const diversifyConfig = { ...DEFAULT_DIVERSIFY, ...(options.diversify ?? {}) };

  const selected: EvidenceIndexItem[] = [];
  const selectedIds = new Set<string>();
  const addItem = (item?: EvidenceIndexItem | null) => {
    if (!item || selectedIds.has(item.id)) return;
    selectedIds.add(item.id);
    selected.push(item);
  };

  const ensureTop = Math.min(diversifyConfig.ensureTop, candidates.length);
  candidates.slice(0, ensureTop).forEach((item) => addItem(item));

  if (teamContext?.hasTeamIntent && teamContext.teams.length >= 2) {
    const perTeamBase = Math.max(
      1,
      Math.floor(
        diversifyConfig.maxEvidence / Math.max(2, teamContext.teams.length * 2),
      ),
    );
    for (const team of teamContext.teams) {
      const target =
        teamContext.mentionedTeam === team ? perTeamBase + 1 : perTeamBase;
      const teamCandidates = candidates
        .filter((item) => teamContext.assignments.get(item.id) === team)
        .sort((a, b) => (scoredMap.get(b.id) ?? 0) - (scoredMap.get(a.id) ?? 0));
      for (const item of teamCandidates.slice(0, target)) {
        addItem(item);
      }
    }
  }

  const { shortest, longest, median } = pickDurationExtremes(candidates);
  addItem(median);
  addItem(shortest);
  addItem(longest);

  selectRareLabelItems(candidates, index, scoredMap, diversifyConfig.maxRare).forEach(
    (item) => addItem(item),
  );

  if (options.insightEvidenceIds?.length) {
    let added = 0;
    for (const id of options.insightEvidenceIds) {
      const item = index.byId.get(id);
      if (item) {
        addItem(item);
        added += 1;
      }
      if (added >= diversifyConfig.maxInsight) break;
    }
  }

  const target = computeTargetCount(selected.length, diversifyConfig.maxEvidence);
  for (const item of candidates) {
    if (selected.length >= target) break;
    addItem(item);
  }

  return selected.slice(0, target);
};
