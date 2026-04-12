import type { EvidenceItem } from './aiTypes';
import type { AiEvidenceDistributionStat } from './eventInsights.types';

export const uniqueIds = (ids: string[], limit = 5) => {
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

export const collectEvidenceDistribution = (
  evidence: EvidenceItem[],
  type: 'action' | 'label',
  limit = 6,
): AiEvidenceDistributionStat[] => {
  const counts = new Map<string, { count: number; ids: string[] }>();
  for (const item of evidence) {
    if (type === 'action') {
      const key = item.actionName || '未設定';
      const entry = counts.get(key) ?? { count: 0, ids: [] };
      entry.count += 1;
      if (entry.ids.length < 5) entry.ids.push(item.id);
      counts.set(key, entry);
    } else {
      for (const label of item.labels) {
        const key = label.group ? `${label.group}:${label.name}` : label.name;
        const entry = counts.get(key) ?? { count: 0, ids: [] };
        entry.count += 1;
        if (entry.ids.length < 5) entry.ids.push(item.id);
        counts.set(key, entry);
      }
    }
  }

  const total = evidence.length;
  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      count: value.count,
      share: total > 0 ? value.count / total : 0,
      evidenceIds: uniqueIds(value.ids),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const collectEvidenceDurationDistribution = (
  evidence: EvidenceItem[],
  limit = 6,
): AiEvidenceDistributionStat[] => {
  const counts = new Map<
    string,
    { count: number; duration: number; ids: string[] }
  >();
  let totalDuration = 0;
  for (const item of evidence) {
    const key = item.actionName || '未設定';
    const duration = Math.max(0, item.endTime - item.startTime);
    totalDuration += duration;
    const entry = counts.get(key) ?? { count: 0, duration: 0, ids: [] };
    entry.count += 1;
    entry.duration += duration;
    if (entry.ids.length < 5) entry.ids.push(item.id);
    counts.set(key, entry);
  }

  const total = evidence.length;
  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      count: value.count,
      share: total > 0 ? value.count / total : 0,
      totalDuration: value.duration,
      avgDuration: value.count > 0 ? value.duration / value.count : 0,
      shareDuration: totalDuration > 0 ? value.duration / totalDuration : 0,
      evidenceIds: uniqueIds(value.ids),
    }))
    .sort(
      (a, b) =>
        (b.totalDuration ?? 0) - (a.totalDuration ?? 0) || b.count - a.count,
    )
    .slice(0, limit);
};
