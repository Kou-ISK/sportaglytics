export type UnknownRecord = Record<string, unknown>;

export interface FileDialogFilterPayload {
  name: string;
  extensions: string[];
}

export interface CaptureRegionPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SyncDataPayload {
  syncOffset: number;
  isAnalyzed: boolean;
  confidenceScore?: number;
}

export interface PackageAnglePayloadGuarded {
  id: string;
  name: string;
  sourcePath: string;
  role?: 'primary' | 'secondary';
}

export const isPlainObject = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isStringPayload = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

export const isStringArray = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
};

export const isFileDialogFilterArray = (
  value: unknown,
): value is FileDialogFilterPayload[] => {
  return (
    Array.isArray(value) &&
    value.every((filter) => {
      return (
        isPlainObject(filter) &&
        typeof filter.name === 'string' &&
        isStringArray(filter.extensions)
      );
    })
  );
};

export const isCaptureRegionPayload = (
  value: unknown,
): value is CaptureRegionPayload => {
  return (
    isPlainObject(value) &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height)
  );
};

export const isSyncDataPayload = (value: unknown): value is SyncDataPayload => {
  return (
    isPlainObject(value) &&
    typeof value.syncOffset === 'number' &&
    Number.isFinite(value.syncOffset) &&
    typeof value.isAnalyzed === 'boolean' &&
    (value.confidenceScore === undefined ||
      (typeof value.confidenceScore === 'number' &&
        Number.isFinite(value.confidenceScore)))
  );
};

export const isPackageAnglePayloadArray = (
  value: unknown,
): value is PackageAnglePayloadGuarded[] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((angle) => {
      return (
        isPlainObject(angle) &&
        isNonEmptyString(angle.id) &&
        isNonEmptyString(angle.name) &&
        isNonEmptyString(angle.sourcePath) &&
        (angle.role === undefined ||
          angle.role === 'primary' ||
          angle.role === 'secondary')
      );
    })
  );
};

export const normalizeSyncDataPayload = (
  value: unknown,
): SyncDataPayload | null => {
  if (!isSyncDataPayload(value)) {
    return null;
  }

  return {
    syncOffset: value.syncOffset,
    isAnalyzed: value.isAnalyzed,
    confidenceScore: value.confidenceScore,
  };
};

export const isAnalysisReportPayload = (value: unknown): boolean => {
  return (
    isPlainObject(value) &&
    isPlainObject(value.meta) &&
    isPlainObject(value.dashboard) &&
    isPlainObject(value.momentum) &&
    isPlainObject(value.matrix)
  );
};
