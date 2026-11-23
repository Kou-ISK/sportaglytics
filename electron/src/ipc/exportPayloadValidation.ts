import { isSlideDuration, isSlidePng } from '../../../src/shared/playlist/playlistSlide';
import { isExportChroma } from './exportChroma';
import { isExportMotionOverlays } from './exportMotionValidation';
import { isExportFreezeFrames } from './exportFreezeFramesValidation';
import { isNonEmptyString, isPlainObject } from './ipcPayloadGuards';
import type { ExportClipsPayload } from './exportHandlers.types';

const isOptionalString = (value: unknown): boolean => {
  return value === undefined || typeof value === 'string';
};

const isOptionalNumber = (value: unknown): boolean => {
  return (
    value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
};

const isClipExportOverlay = (value: unknown): boolean => {
  return (
    isPlainObject(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.showActionName === 'boolean' &&
    typeof value.showActionIndex === 'boolean' &&
    typeof value.showLabels === 'boolean' &&
    typeof value.showMemo === 'boolean'
  );
};

const isExportMode = (value: unknown): boolean => {
  return (
    value === undefined ||
    value === 'single' ||
    value === 'perInstance' ||
    value === 'perRow' ||
    value === 'organizerRows'
  );
};

const isAngleOption = (value: unknown): boolean => {
  return (
    value === undefined ||
    value === 'all' ||
    value === 'allAngles' ||
    value === 'single' ||
    value === 'multi' ||
    value === 'angle1' ||
    value === 'angle2'
  );
};

const isClipExportItem = (value: unknown): boolean => {
  if (
    !isPlainObject(value) ||
    typeof value.startTime !== 'number' ||
    typeof value.endTime !== 'number'
  )
    return false;
  const duration = value.endTime - value.startTime;
  return (
    isPlainObject(value) &&
    (value.slideFrame === undefined || (
      value.startTime === 0 && isSlideDuration(value.endTime) && isSlidePng(value.slideFrame, true) &&
      value.videoSource === undefined && value.videoSource2 === undefined &&
      value.freezeFrames === undefined && value.motionOverlays === undefined &&
      value.annotationPngPrimary === undefined && value.annotationPngSecondary === undefined
    )) &&
    (value.audioTrackIndex === undefined ||
      (typeof value.audioTrackIndex === 'number' &&
        Number.isInteger(value.audioTrackIndex) &&
        value.audioTrackIndex >= 0 &&
        value.audioTrackIndex <= 63)) &&
    (value.organizerRow === undefined ||
      (isPlainObject(value.organizerRow) &&
        isNonEmptyString(value.organizerRow.id) &&
        isNonEmptyString(value.organizerRow.name))) &&
    isNonEmptyString(value.id) &&
    typeof value.actionName === 'string' &&
    typeof value.startTime === 'number' &&
    Number.isFinite(value.startTime) &&
    typeof value.endTime === 'number' &&
    Number.isFinite(value.endTime) &&
    isExportFreezeFrames(value.freezeFrames, duration) &&
    isExportMotionOverlays(value.motionOverlays, duration) &&
    isExportChroma(value.chromaKey) &&
    (value.freezeAt === null || isOptionalNumber(value.freezeAt)) &&
    isOptionalNumber(value.freezeDuration) &&
    (value.labels === undefined ||
      (Array.isArray(value.labels) &&
        value.labels.every(
          (label) =>
            isPlainObject(label) &&
            typeof label.group === 'string' &&
            typeof label.name === 'string',
        ))) &&
    isOptionalNumber(value.actionIndex) &&
    isOptionalString(value.memo) &&
    isOptionalString(value.videoSource) &&
    isOptionalString(value.videoSource2) &&
    (value.angleType === undefined ||
      value.angleType === 'angle1' ||
      value.angleType === 'angle2')
  );
};

export const isExportClipsPayload = (
  value: unknown,
): value is ExportClipsPayload => {
  return (
    isPlainObject(value) &&
    isOptionalString(value.progressId) &&
    (isNonEmptyString(value.sourcePath) || (value.sourcePath === '' &&
      Array.isArray(value.clips) && value.clips.length > 0 &&
      value.clips.every((clip) => isPlainObject(clip) && typeof clip.slideFrame === 'string'))) &&
    isOptionalString(value.sourcePath2) &&
    (value.mode === undefined ||
      value.mode === 'single' ||
      value.mode === 'dual') &&
    isExportMode(value.exportMode) &&
    isAngleOption(value.angleOption) &&
    Array.isArray(value.clips) &&
    value.clips.reduce((bytes: number, clip: unknown) =>
      bytes + (isPlainObject(clip) && typeof clip.slideFrame === 'string' ? clip.slideFrame.length : 0), 0) <= 32 * 1024 * 1024 &&
    value.clips.every(isClipExportItem) &&
    (value.exportMode !== 'organizerRows' ||
      value.clips.every((clip) => isPlainObject(clip) && isPlainObject(clip.organizerRow))) &&
    isClipExportOverlay(value.overlay) &&
    isOptionalString(value.outputDir) &&
    isOptionalString(value.outputFileName)
  );
};
