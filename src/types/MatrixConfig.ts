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
