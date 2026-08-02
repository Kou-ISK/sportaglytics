import type { TimelineData, TimelineRow } from '../../../types/timeline/core';

const ROW_COLORS = [
  '#4D8DFF',
  '#EF5B5B',
  '#45B97C',
  '#E4A73A',
  '#9B6DE3',
  '#D95D9F',
  '#39AEB7',
  '#89939E',
] as const;

const hashName = (name: string): number => {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;
  }
  return Math.abs(hash);
};

export const getDefaultTimelineRowColor = (name: string): string =>
  ROW_COLORS[hashName(name) % ROW_COLORS.length];

export const deriveTimelineRows = (timeline: TimelineData[]): TimelineRow[] => {
  const rows: TimelineRow[] = [];
  const seen = new Set<string>();

  for (const item of timeline) {
    const name = item.actionName.trim() || '名称未設定';
    if (seen.has(name)) continue;
    seen.add(name);
    rows.push({
      id: `legacy-row-${rows.length + 1}`,
      name,
      color: item.color ?? getDefaultTimelineRowColor(name),
    });
  }

  return rows;
};

export const ensureTimelineRows = (
  rows: TimelineRow[],
  timeline: TimelineData[],
): TimelineRow[] => {
  const names = new Set(rows.map((row) => row.name));
  const missing = deriveTimelineRows(timeline).filter(
    (row) => !names.has(row.name),
  );
  if (missing.length === 0) return rows;

  return [
    ...rows,
    ...missing.map((row, index) => ({
      ...row,
      id: `derived-row-${rows.length + index + 1}`,
    })),
  ];
};

export const buildTimelineRowMoveUpdates = (
  rows: TimelineRow[],
  targetName: string,
): Pick<TimelineData, 'actionName' | 'color'> => ({
  actionName: targetName,
  color:
    rows.find((row) => row.name === targetName)?.color ??
    getDefaultTimelineRowColor(targetName),
});

export const moveTimelineRowInList = (
  rows: TimelineRow[],
  sourceId: string,
  targetId: string,
): TimelineRow[] => {
  if (sourceId === targetId) return rows;
  const sourceIndex = rows.findIndex((row) => row.id === sourceId);
  const targetIndex = rows.findIndex((row) => row.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return rows;
  const next = [...rows];
  const [source] = next.splice(sourceIndex, 1);
  if (!source) return rows;
  next.splice(targetIndex, 0, source);
  return next;
};

export const pasteTimelineItemsInRow = (
  timeline: TimelineData[],
  copiedItems: TimelineData[],
  targetRow: TimelineRow,
  pastedIds: string[],
): TimelineData[] => {
  if (copiedItems.length === 0 || pastedIds.length !== copiedItems.length) {
    return timeline;
  }
  const pastedItems = copiedItems.map((item, index) => ({
    ...item,
    id: pastedIds[index] ?? item.id,
    actionName: targetRow.name,
    color: targetRow.color,
    labels: item.labels?.map((label) => ({ ...label })),
  }));
  return [...timeline, ...pastedItems];
};

export const isTimelineRow = (value: unknown): value is TimelineRow => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    row.name.trim().length > 0 &&
    typeof row.color === 'string'
  );
};
