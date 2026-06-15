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
