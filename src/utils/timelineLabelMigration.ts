import type { SCLabel } from '../types/timeline/sportscode';

const LEGACY_LABEL_GROUP_MIGRATIONS: Record<string, string> = {
  actionResult: 'Result',
  actionType: 'Type',
};

export const migrateLegacyLabelGroupName = (
  group: string | undefined,
): string | undefined => {
  if (!group) return group;
  return LEGACY_LABEL_GROUP_MIGRATIONS[group] ?? group;
};

export const migrateLegacyTimelineLabels = (
  labels: SCLabel[] | undefined,
): SCLabel[] => {
  if (!labels || labels.length === 0) return [];

  const seen = new Set<string>();
  const migrated: SCLabel[] = [];
  for (const label of labels) {
    const group = migrateLegacyLabelGroupName(label.group);
    const key = `${group ?? ''}\u0000${label.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    migrated.push(group ? { name: label.name, group } : { name: label.name });
  }
  return migrated;
};
