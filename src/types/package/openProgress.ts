export interface PackageOpenProgress {
  requestId: string;
  phase: 'preparing' | 'backup-directory';
  canCancel: boolean;
}

export const isPackageOpenRequestId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);

export const isPackageOpenProgress = (
  value: unknown,
): value is PackageOpenProgress => {
  if (!value || typeof value !== 'object') return false;
  return (
    'requestId' in value &&
    isPackageOpenRequestId(value.requestId) &&
    'phase' in value &&
    (value.phase === 'preparing' || value.phase === 'backup-directory') &&
    'canCancel' in value &&
    typeof value.canCancel === 'boolean' &&
    (!value.canCancel || value.phase === 'backup-directory')
  );
};
