import { isFiniteNumber, isOptional, isPlainObject, isString } from './shared';

export const EXPORT_PROGRESS_WINDOW_CHANNELS = {
  sync: 'export-progress:sync',
  requestState: 'export-progress:request-state',
} as const;

export type ExportProgressStatus = 'running' | 'completed' | 'failed';

export interface ExportProgressWindowState {
  id: string;
  status: ExportProgressStatus;
  current: number;
  total: number;
  message: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

const EXPORT_PROGRESS_STATUSES = new Set<ExportProgressStatus>([
  'running',
  'completed',
  'failed',
]);

export const isExportProgressWindowState = (
  value: unknown,
): value is ExportProgressWindowState => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.status) &&
    EXPORT_PROGRESS_STATUSES.has(value.status as ExportProgressStatus) &&
    isFiniteNumber(value.current) &&
    isFiniteNumber(value.total) &&
    isString(value.message) &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.updatedAt) &&
    isOptional(value.completedAt, isFiniteNumber) &&
    isOptional(value.error, isString)
  );
};
