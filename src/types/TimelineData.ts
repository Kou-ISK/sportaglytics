import type { SCLabel } from './SCTimeline';

export type TimelineData = {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  memo: string;
  /**
   * SCTimeline形式のラベル配列
   */
  labels?: SCLabel[];
  /**
   * タイムライン行の表示色（アクションボタンの色）
   * 指定がない場合はチーム色が使用される
   */
  color?: string;
};
