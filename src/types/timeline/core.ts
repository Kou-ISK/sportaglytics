import type { SCLabel } from './sportscode';

export interface TimelineData {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  memo: string;
  labels?: SCLabel[];
  color?: string;
}

/** タイムラインの行。色と表示順はインスタンスではなく行が所有する。 */
export interface TimelineRow {
  id: string;
  name: string;
  color: string;
}

export interface TimelineDocument {
  version: 2;
  rows: TimelineRow[];
  instances: TimelineData[];
}
