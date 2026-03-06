import type { EvidenceIndexItem } from './evidenceIndex';

export type TeamContext = {
  hasTeamIntent: boolean;
  mentionedTeam?: string;
  teams: string[];
  assignments: Map<string, string>;
  source: 'label' | 'inferred';
  confidence: number;
};

const TEAM_SPLIT_REGEX = /[\s\u3000/／・\\\-–—_]+/;
const TEAM_KEYWORDS = [
  'チーム',
  '相手',
  '自チーム',
  '自分たち',
  '相手側',
  'どっち',
  'どちら',
  'ホーム',
  'アウェイ',
];

const splitTeamActionName = (
  actionName: string,
): { team: string; action: string } | null => {
  const trimmed = (actionName ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(TEAM_SPLIT_REGEX).filter(Boolean);
  if (parts.length < 2) return null;
  const team = parts[0]?.trim();
  const action = parts.slice(1).join(' ').trim();
  if (!team || !action) return null;
  if (/^[\d\W]+$/.test(team)) return null;
  return { team, action };
};

const resolveTeamAssignmentsFromLabels = (
  items: EvidenceIndexItem[],
): TeamContext | null => {
  if (items.length === 0) return null;
  const labelGroups = new Map<string, Map<string, number>>();
  const groupItemCounts = new Map<string, number>();
  for (const item of items) {
    const seenGroups = new Set<string>();
    for (const label of item.labels) {
      if (!label.group || !label.name) continue;
      const groupKey = label.group.toLowerCase();
      const nameKey = label.name;
      const group = labelGroups.get(groupKey) ?? new Map<string, number>();
      group.set(nameKey, (group.get(nameKey) ?? 0) + 1);
      labelGroups.set(groupKey, group);
      if (!seenGroups.has(groupKey)) {
        groupItemCounts.set(groupKey, (groupItemCounts.get(groupKey) ?? 0) + 1);
        seenGroups.add(groupKey);
      }
    }
  }

  const total = items.length;
  const candidates = Array.from(labelGroups.entries()).map(([group, counts]) => {
    const coverage = (groupItemCounts.get(group) ?? 0) / total;
    return { group, counts, coverage };
  });

  const teamGroupCandidates = candidates
    .filter((entry) => entry.group.includes('team') || entry.group.includes('チーム'))
    .sort((a, b) => b.counts.size - a.counts.size);
  const fallbackCandidates = candidates
    .filter(
      (entry) =>
        entry.coverage >= 0.6 &&
        entry.counts.size >= 2 &&
        entry.counts.size <= 4,
    )
    .sort((a, b) => b.coverage - a.coverage);

  const selected = teamGroupCandidates[0] ?? fallbackCandidates[0];
  if (!selected) return null;
  const groupKey = selected.group;
  const counts = selected.counts;
  const minCount = Math.max(2, Math.ceil(total * 0.1));
  const teams = Array.from(counts.entries())
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  if (teams.length < 2) return null;
  const teamSet = new Set(teams);
  const assignments = new Map<string, string>();
  for (const item of items) {
    const label = item.labels.find(
      (entry) => (entry.group ?? '').toLowerCase() === groupKey,
    );
    if (!label?.name || !teamSet.has(label.name)) continue;
    assignments.set(item.id, label.name);
  }

  const confidence = total > 0 ? assignments.size / total : 0;
  return {
    hasTeamIntent: false,
    teams,
    assignments,
    source: 'label',
    confidence,
  };
};

const resolveTeamAssignmentsFromActionName = (
  items: EvidenceIndexItem[],
): TeamContext | null => {
  const candidateMap = new Map<string, { count: number; actions: Set<string> }>();
  for (const item of items) {
    const parsed = splitTeamActionName(item.actionName);
    if (!parsed) continue;
    const entry = candidateMap.get(parsed.team) ?? {
      count: 0,
      actions: new Set<string>(),
    };
    entry.count += 1;
    entry.actions.add(parsed.action);
    candidateMap.set(parsed.team, entry);
  }
  const total = items.length;
  if (total === 0 || candidateMap.size === 0) return null;
  const minCount = Math.max(2, Math.ceil(total * 0.1));
  const candidates = Array.from(candidateMap.entries())
    .map(([team, info]) => ({
      team,
      count: info.count,
      actions: info.actions.size,
    }))
    .filter((entry) => entry.count >= minCount && entry.actions >= 2)
    .sort((a, b) => b.count - a.count);

  if (candidates.length < 2) return null;
  const coverage =
    candidates.slice(0, 3).reduce((sum, entry) => sum + entry.count, 0) / total;
  if (coverage < 0.6) return null;

  const teamSet = new Set(candidates.slice(0, 3).map((entry) => entry.team));
  const assignments = new Map<string, string>();
  for (const item of items) {
    const parsed = splitTeamActionName(item.actionName);
    if (!parsed) continue;
    if (!teamSet.has(parsed.team)) continue;
    assignments.set(item.id, parsed.team);
  }
  const confidence = total > 0 ? assignments.size / total : 0;
  return {
    hasTeamIntent: false,
    teams: Array.from(teamSet),
    assignments,
    source: 'inferred',
    confidence,
  };
};

export const resolveTeamContext = (
  query: string,
  items: EvidenceIndexItem[],
): TeamContext | null => {
  const labelContext = resolveTeamAssignmentsFromLabels(items);
  const actionContext = labelContext
    ? null
    : resolveTeamAssignmentsFromActionName(items);
  const base = labelContext ?? actionContext;
  if (!base || base.teams.length === 0) return null;

  const normalized = query.toLowerCase();
  let mentionedTeam: string | undefined;
  for (const team of base.teams) {
    if (team && normalized.includes(team.toLowerCase())) {
      mentionedTeam = team;
      break;
    }
  }

  const hasTeamKeyword = TEAM_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );

  return {
    ...base,
    hasTeamIntent: Boolean(mentionedTeam || hasTeamKeyword),
    mentionedTeam,
  };
};
