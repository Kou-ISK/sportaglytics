import { isBoolean, isFiniteNumber, isOptional, isPlainObject, isString } from './shared';

export const EXPORT_PROGRESS_WINDOW_CHANNELS = {
  sync: 'export-progress:sync',
  requestState: 'export-progress:request-state',
  cancel: 'export-progress:cancel',
} as const;

export type ExportProgressStatus =
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed';
export type CancelExportResult =
  | 'accepted'
  | 'already-requested'
  | 'too-late'
  | 'not-found';

/** Locally presented information only; it does not authorize cleanup. */
export interface RetainedExportDirectory {
  id: string;
  path: string;
  purpose: 'final-staging' | 'native-staging' | 'native-temp';
  device: string;
  inode: string;
  reason: 'publication-uncertain' | 'cleanup-failed' | 'retained-after-failure';
  writerStatus: 'unknown';
}

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
  retainedDirectories?: RetainedExportDirectory[];
  retainedLocationUnknown?: boolean;
}

const EXPORT_PROGRESS_STATUSES = new Set<ExportProgressStatus>([
  'running',
  'cancelling',
  'cancelled',
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
    isOptional(value.error, isString) &&
    isOptional(value.retainedLocationUnknown, isBoolean) &&
    (value.retainedDirectories === undefined ||
      (Array.isArray(value.retainedDirectories) &&
        value.retainedDirectories.every(
          (entry) =>
            isPlainObject(entry) &&
            isString(entry.id) &&
            isString(entry.path) &&
            (entry.purpose === 'final-staging' ||
              entry.purpose === 'native-staging' ||
              entry.purpose === 'native-temp') &&
            isString(entry.device) &&
            isString(entry.inode) &&
            (entry.reason === 'publication-uncertain' ||
              entry.reason === 'cleanup-failed' ||
              entry.reason === 'retained-after-failure') &&
            entry.writerStatus === 'unknown',
        )))
  );
};
