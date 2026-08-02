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
  angleOffsets?: number[];
}

export interface PackageAnglePayloadGuarded {
  id: string;
  name: string;
  clips: Array<{
    id: string;
    sourceKind: 'local' | 'youtube';
    source: string;
    gapBeforeSeconds: number;
  }>;
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
        Number.isFinite(value.confidenceScore))) &&
    (value.angleOffsets === undefined ||
      (Array.isArray(value.angleOffsets) &&
        value.angleOffsets.length <= 8 &&
        value.angleOffsets.every(
          (offset) =>
            typeof offset === 'number' &&
            Number.isFinite(offset) &&
            Math.abs(offset) <= 86400,
        )))
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
        Array.isArray(angle.clips) &&
        angle.clips.length > 0 &&
        angle.clips.length <= 16 &&
        angle.clips.every(
          (clip) =>
            isPlainObject(clip) &&
            isNonEmptyString(clip.id) &&
            (clip.sourceKind === 'local' || clip.sourceKind === 'youtube') &&
            isNonEmptyString(clip.source) &&
            typeof clip.gapBeforeSeconds === 'number' &&
            Number.isFinite(clip.gapBeforeSeconds) &&
            clip.gapBeforeSeconds >= 0 &&
            (clip.timelineStartSeconds === undefined ||
              (typeof clip.timelineStartSeconds === 'number' &&
                Number.isFinite(clip.timelineStartSeconds) &&
                clip.timelineStartSeconds >= 0 &&
                clip.timelineStartSeconds <= 86400)) &&
            (clip.durationSeconds === undefined ||
              (typeof clip.durationSeconds === 'number' &&
                Number.isFinite(clip.durationSeconds) &&
                clip.durationSeconds > 0)),
        ) &&
        (angle.role === undefined ||
          angle.role === 'primary' ||
          angle.role === 'secondary')
      );
    }) &&
    value.length <= 8
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
    angleOffsets: value.angleOffsets,
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
