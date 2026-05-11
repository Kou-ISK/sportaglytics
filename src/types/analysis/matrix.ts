import type { TimelineData } from '../timeline/core';

export type MatrixAxisType = 'group' | 'team' | 'action';

export interface MatrixAxisConfig {
  type: MatrixAxisType;
  value?: string;
}

export interface MatrixCell {
  count: number;
  entries: TimelineData[];
}
