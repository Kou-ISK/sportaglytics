import type { SCLabel } from './SCTimeline';

export type TimelineData = {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  actionResult: string;
  actionType: string;
  qualifier: string;
  /**
   * SCTimeline形式のラベル配列（オプショナル）
   * 存在する場合、actionType/actionResultよりも優先される
   * 後方互換性のため、存在しない場合はactionType/actionResultから自動生成される
   */
  labels?: SCLabel[];
};
