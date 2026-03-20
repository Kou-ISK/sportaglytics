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
 * 階層構造を持つ行ヘッダー
 */
export interface HierarchicalRowHeader {
  /** 親要素（チームやグループなど）。存在しない場合はnull */
  parent: string | null;
  /** 子要素（アクションやラベルなど） */
  child: string;
  /** この行のデータが何番目から何番目までのセルか */
  rowIndex: number;
  /** 親要素のrowspan（結合する行数）。親がない場合は1 */
  parentRowSpan?: number;
  /** この親要素の最初の行かどうか */
  isFirstOfParent?: boolean;
}

/**
 * 階層構造を持つ列ヘッダー
 */
export interface HierarchicalColumnHeader {
  /** 親要素（グループなど）。存在しない場合はnull */
  parent: string | null;
  /** 子要素（ラベルなど） */
  child: string;
  /** 列のインデックス */
  colIndex: number;
  /** 親要素のcolspan（結合する列数）。親がない場合は1 */
  parentColSpan?: number;
  /** この親要素の最初の列かどうか */
  isFirstOfParent?: boolean;
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
