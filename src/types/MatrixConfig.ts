import type { TimelineData } from '../types/TimelineData';

/**
 * マトリクスの軸設定タイプ
 */
export type MatrixAxisType =
  | 'group' // labels配列のgroup
  | 'team' // actionNameから抽出したteam
  | 'action'; // actionNameから抽出したaction

/**
 * マトリクスの軸設定
 */
export interface MatrixAxisConfig {
  /** 軸のタイプ */
  type: MatrixAxisType;
  /**
   * type='group'の場合: group名（例: 'actionType', 'actionResult'）
   * type='team'の場合: 使用しない
   * type='action'の場合: フィルタするteam名（省略時は全team）
   */
  value?: string;
}

/**
 * マトリクスセル（カウントと該当エントリ）
 */
export interface MatrixCell {
  count: number;
  entries: TimelineData[];
}

/**
 * マトリクス設定のプリセット
 */
export interface MatrixPreset {
  id: string;
  name: string;
  description: string;
  rowAxis: MatrixAxisConfig;
  columnAxis: MatrixAxisConfig;
}

/**
 * デフォルトのマトリクスプリセット
 */
export const DEFAULT_MATRIX_PRESETS: MatrixPreset[] = [
  {
    id: 'type-vs-result',
    name: 'アクション種別 × アクション結果',
    description: 'アクション種別とアクション結果のクロス分析',
    rowAxis: { type: 'group', value: 'actionType' },
    columnAxis: { type: 'group', value: 'actionResult' },
  },
  {
    id: 'team-action-vs-type',
    name: 'チームアクション × アクション種別',
    description: 'チーム別のアクションとアクション種別のクロス分析',
    rowAxis: { type: 'action' },
    columnAxis: { type: 'group', value: 'actionType' },
  },
  {
    id: 'team-action-vs-result',
    name: 'チームアクション × アクション結果',
    description: 'チーム別のアクションとアクション結果のクロス分析',
    rowAxis: { type: 'action' },
    columnAxis: { type: 'group', value: 'actionResult' },
  },
  {
    id: 'team-vs-type',
    name: 'チーム × アクション種別',
    description: 'チームとアクション種別のクロス分析',
    rowAxis: { type: 'team' },
    columnAxis: { type: 'group', value: 'actionType' },
  },
  {
    id: 'team-vs-result',
    name: 'チーム × アクション結果',
    description: 'チームとアクション結果のクロス分析',
    rowAxis: { type: 'team' },
    columnAxis: { type: 'group', value: 'actionResult' },
  },
];
