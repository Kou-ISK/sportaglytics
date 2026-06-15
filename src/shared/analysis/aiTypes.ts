import type { SCLabel } from '../../types/timeline/sportscode';

export interface EvidenceItem {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  memo: string;
  labels: SCLabel[];
  text: string;
}

export interface EvidenceFilters {
  timeRange?: {
    start?: number | null;
    end?: number | null;
  };
  labelFilters?: Array<{
    group?: string;
    name?: string;
  }>;
}
