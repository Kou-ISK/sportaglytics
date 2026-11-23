import type { ClipExportItem } from './exportHandlers.types';

interface ClipGroup {
  label: string;
  clips: ClipExportItem[];
}

export const groupExportClips = (
  clips: ClipExportItem[],
  mode: 'organizerRows' | 'perRow',
): ClipGroup[] => {
  const groups = new Map<string, ClipGroup>();
  for (const clip of clips) {
    const row = clip.organizerRow;
    if (mode === 'organizerRows' && !row) throw new Error('所属行を確認できません');
    const key = mode === 'organizerRows' && row ? row.id : clip.actionName;
    const label = mode === 'organizerRows' && row ? row.name : clip.actionName;
    const group = groups.get(key);
    if (group) group.clips.push(clip);
    else groups.set(key, { label, clips: [clip] });
  }
  return [...groups.values()];
};
