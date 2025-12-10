import type { SCLabel } from './SCTimeline';

export type TimelineData = {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  /**
   * @deprecated labels配列を使用してください。後方互換性のために残されています。
   */
  actionResult?: string;
  /**
   * @deprecated labels配列を使用してください。後方互換性のために残されています。
   */
  actionType?: string;
  qualifier: string;
  /**
   * SCTimeline形式のラベル配列
   * 存在する場合、actionType/actionResultよりも優先される
   */
  labels?: SCLabel[];
  /**
   * タイムライン行の表示色（アクションボタンの色）
   * 指定がない場合はチーム色が使用される
   */
  color?: string;
};
