import type { PlaylistItem } from '../../../types/playlist/core';

export type SorterColumnId =
  | 'index'
  | 'action'
  | 'start'
  | 'duration'
  | 'labels'
  | 'note'
  | 'annotation'
  | 'video';
export type SorterSortKey = Exclude<SorterColumnId, 'index'> | 'added';
export type SorterDirection = 'asc' | 'desc';
export interface SorterColumn {
  id: SorterColumnId;
  label: string;
  width: number;
  visible: boolean;
}
export interface SorterSort {
  column: SorterSortKey;
  direction: SorterDirection;
}
export const DEFAULT_SORTER_COLUMNS: SorterColumn[] = [
  { id: 'index', label: '再生順', width: 68, visible: true },
  { id: 'action', label: 'アクション', width: 180, visible: true },
  { id: 'start', label: '開始', width: 100, visible: true },
  { id: 'duration', label: '長さ', width: 88, visible: true },
  { id: 'labels', label: 'ラベル', width: 180, visible: true },
  { id: 'note', label: 'ノート', width: 180, visible: true },
  { id: 'annotation', label: '注釈', width: 88, visible: true },
  { id: 'video', label: '映像', width: 140, visible: true },
];
export const SORTER_SORT_OPTIONS: Array<{ id: SorterSortKey; label: string }> =
  [
    { id: 'added', label: '追加日時' },
    ...DEFAULT_SORTER_COLUMNS.filter(
      (column): column is SorterColumn & { id: SorterSortKey } =>
        column.id !== 'index',
    ),
  ];
export const sorterLabels = (item: PlaylistItem): string =>
  item.labels?.map((label) => label.name).join(' / ') ?? '';
export const sorterVideoName = (item: PlaylistItem): string => {
  const secondary = item.defaultAngle === 'angle2';
  const source = secondary ? item.videoSource2 : item.videoSource;
  const name = (source ?? '').split(/[\\/]/).at(-1) ?? '';
  return item.videoSource2 || item.mediaReference2
    ? `アングル${secondary ? 2 : 1} · ${name || '未接続'}`
    : name;
};
export const getSorterCellValue = (
  item: PlaylistItem,
  column: SorterSortKey,
): string | number => {
  switch (column) {
    case 'added':
      return item.addedAt;
    case 'action':
      return item.actionName;
    case 'start':
      return item.startTime;
    case 'duration':
      return item.endTime - item.startTime;
    case 'labels':
      return sorterLabels(item);
    case 'note':
      return item.note ?? '';
    case 'annotation':
      return item.annotation ? 1 : 0;
    case 'video':
      return sorterVideoName(item);
  }
};
const collator = new Intl.Collator('ja', {
  numeric: true,
  sensitivity: 'base',
});
export const sortSorterItems = (
  items: PlaylistItem[],
  column: SorterSortKey,
  direction: SorterDirection,
): PlaylistItem[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = getSorterCellValue(a.item, column);
      const right = getSorterCellValue(b.item, column);
      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : collator.compare(String(left), String(right));
      return comparison * (direction === 'asc' ? 1 : -1) || a.index - b.index;
    })
    .map(({ item }) => item);
export const filterSorterItems = (
  items: PlaylistItem[],
  query: string,
): PlaylistItem[] => {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized
    ? items.filter((item) =>
        [item.actionName, sorterLabels(item), item.note, sorterVideoName(item)]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalized),
      )
    : items;
};
export const formatSorterTime = (seconds: number): string => {
  const tenths = Math.round(seconds * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
};
