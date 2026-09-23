import type {
  PlaylistAiMeta,
  PlaylistMediaReference,
  PlaylistMediaResolution,
  ItemAnnotation,
  Playlist,
  PlaylistFileLoadResult,
  PlaylistItem,
  PlaylistRow,
  PlaylistSaveProgressPayload,
  PlaylistState,
} from '../playlist/core';
import type { PlaylistCommand, PlaylistSyncData } from '../playlist/window';
import type { SCLabel } from '../timeline/sportscode';
import {
  isArrayOf,
  isBoolean,
  isFiniteNumber,
  isOptional,
  isPlainObject,
  isString,
  isStringArray,
  isStringOrNull,
} from './shared';

export const PLAYLIST_WINDOW_CHANNELS = {
  ready: 'playlist:ready',
  resolveMedia: 'playlist:resolve-media',
  relinkPackage: 'playlist:relink-package',
  openWindow: 'playlist:open-window',
  closeWindow: 'playlist:close-window',
  isWindowOpen: 'playlist:is-window-open',
  getOpenCount: 'playlist:get-open-count',
  addItemToAllWindows: 'playlist:add-item-to-all-windows',
  syncToWindow: 'playlist:sync-to-window',
  sync: 'playlist:sync',
  command: 'playlist:command',
  windowClosed: 'playlist:window-closed',
  savedAndClose: 'playlist:saved-and-close',
  saveFile: 'playlist:save-file',
  saveFileAs: 'playlist:save-file-as',
  loadFile: 'playlist:load-file',
  externalOpen: 'playlist:external-open',
  saveProgress: 'playlist:save-progress',
  addItem: 'playlist:add-item',
  requestSave: 'playlist:request-save',
  setWindowTitle: 'playlist:set-window-title',
} as const;

const PLAYLIST_TYPES = new Set(['reference', 'embedded']);
const PLAYLIST_LOOP_MODES = new Set(['none', 'single', 'all']);
const DRAWING_TOOL_TYPES = new Set([
  'beam',
  'disc',
  'linkedDiscs',
  'curvedArrow',
  'ring',
  'spotlight',
  'polygon',
  'pen',
  'line',
  'arrow',
  'rectangle',
  'circle',
  'text',
  'select',
]);
const ANNOTATION_TARGETS = new Set(['primary', 'secondary']);

const isScLabel = (value: unknown): value is SCLabel => {
  if (!isPlainObject(value)) {
    return false;
  }

  return isString(value.name) && isOptional(value.group, isString);
};

const isDrawingObject = (
  value: unknown,
): value is ItemAnnotation['objects'][number] => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.color) &&
    isString(value.type) &&
    DRAWING_TOOL_TYPES.has(value.type) &&
    isFiniteNumber(value.strokeWidth) &&
    isFiniteNumber(value.startX) &&
    isFiniteNumber(value.startY) &&
    isFiniteNumber(value.timestamp) &&
    isOptional(value.fill, isBoolean) &&
    isOptional(value.endX, isFiniteNumber) &&
    isOptional(value.endY, isFiniteNumber) &&
    isOptional(
      value.path,
      (candidate): candidate is Array<{ x: number; y: number }> => {
        return isArrayOf(
          candidate,
          (point): point is { x: number; y: number } => {
            return (
              isPlainObject(point) &&
              isFiniteNumber(point.x) &&
              isFiniteNumber(point.y)
            );
          },
        );
      },
    ) &&
    isOptional(value.text, isString) &&
    isOptional(value.fontSize, isFiniteNumber) &&
    (value.target === undefined ||
      (isString(value.target) && ANNOTATION_TARGETS.has(value.target))) &&
    isOptional(value.baseWidth, isFiniteNumber) &&
    isOptional(value.baseHeight, isFiniteNumber)
  );
};

const isItemAnnotation = (value: unknown): value is ItemAnnotation => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isArrayOf(value.objects, isDrawingObject) &&
    isFiniteNumber(value.freezeDuration) &&
    isFiniteNumber(value.freezeAt)
  );
};

const isPlaylistAiMeta = (value: unknown): value is PlaylistAiMeta => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isOptional(value.reason, isString) &&
    isOptional(value.centerId, isString) &&
    isOptional(value.centerIds, isStringArray) &&
    isOptional(value.evidenceIds, isStringArray) &&
    (value.source === undefined || value.source === 'ai-review')
  );
};

const isPlaylistRow = (value: unknown): value is PlaylistRow => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isBoolean(value.enabled) &&
    isFiniteNumber(value.order) &&
    isOptional(value.color, isString)
  );
};

const isMediaReference = (value: unknown): value is PlaylistMediaReference => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.packageId === 'string' &&
    /^[a-f0-9-]{36}$/i.test(value.packageId) &&
    typeof value.packagePath === 'string' &&
    value.packagePath.length > 0 &&
    value.packagePath.length <= 32768 &&
    typeof value.mediaPath === 'string' &&
    value.mediaPath.length > 0 &&
    value.mediaPath.length <= 32768 &&
    !/^(?:[a-z]:|[/\\])/i.test(value.mediaPath) &&
    !value.mediaPath.split(/[/\\]/).includes('..') &&
    isOptional(value.relativePackagePath, isString)
  );
};

export const isPlaylistItem = (value: unknown): value is PlaylistItem => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isStringOrNull(value.timelineItemId) &&
    isString(value.actionName) &&
    isFiniteNumber(value.startTime) &&
    isFiniteNumber(value.endTime) &&
    isFiniteNumber(value.addedAt) &&
    isOptional(value.labels, (candidate): candidate is SCLabel[] =>
      isArrayOf(candidate, isScLabel),
    ) &&
    isOptional(value.memo, isString) &&
    isOptional(value.note, isString) &&
    isOptional(value.videoSource, isString) &&
    isOptional(value.videoSource2, isString) &&
    (value.defaultAngle === undefined ||
      value.defaultAngle === 'angle1' ||
      value.defaultAngle === 'angle2') &&
    isOptional(value.mediaReference, isMediaReference) &&
    isOptional(value.mediaReference2, isMediaReference) &&
    isOptional(value.annotation, isItemAnnotation) &&
    isOptional(value.aiMeta, isPlaylistAiMeta) &&
    isOptional(value.rowId, isString) &&
    isOptional(value.rowOrder, isFiniteNumber) &&
    isOptional(value.presentationOrder, isFiniteNumber)
  );
};

export const isPlaylistMediaResolution = (
  value: unknown,
): value is PlaylistMediaResolution =>
  isPlainObject(value) &&
  isArrayOf(value.items, isPlaylistItem) &&
  isStringArray(value.missingItemIds);

export const isPlaylist = (value: unknown): value is Playlist => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.type) &&
    PLAYLIST_TYPES.has(value.type) &&
    isArrayOf(value.items, isPlaylistItem) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt) &&
    isOptional(value.description, isString) &&
    isOptional(value.sourcePackagePath, isString) &&
    isOptional(value.rows, (candidate): candidate is PlaylistRow[] =>
      isArrayOf(candidate, isPlaylistRow),
    ) &&
    isOptional(value.schemaVersion, isFiniteNumber)
  );
};

export const isPlaylistState = (value: unknown): value is PlaylistState => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isArrayOf(value.playlists, isPlaylist) &&
    isStringOrNull(value.activePlaylistId) &&
    isStringOrNull(value.playingItemId) &&
    isString(value.loopMode) &&
    PLAYLIST_LOOP_MODES.has(value.loopMode)
  );
};

export const isPlaylistSyncData = (
  value: unknown,
): value is PlaylistSyncData => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isPlaylistState(value.state) &&
    isStringOrNull(value.videoPath) &&
    isStringOrNull(value.videoPath2) &&
    isStringArray(value.videoSources) &&
    isFiniteNumber(value.currentTime) &&
    isOptional(value.packagePath, isString)
  );
};

export const isPlaylistCommand = (value: unknown): value is PlaylistCommand => {
  if (!isPlainObject(value) || !isString(value.type)) {
    return false;
  }

  switch (value.type) {
    case 'seek':
      return isFiniteNumber(value.time);
    case 'play-item':
      return isString(value.itemId);
    case 'update-state':
      return isPlaylistState(value.state);
    case 'add-items':
      return isArrayOf(value.items, isPlaylistItem);
    case 'request-sync':
    case 'get-dirty':
      return true;
    case 'save-playlist':
      return isPlaylist(value.playlist) && isOptional(value.filePath, isString);
    case 'load-playlist':
      return isString(value.filePath);
    case 'set-dirty':
      return isBoolean(value.isDirty);
    default:
      return false;
  }
};

export const isPlaylistSaveProgressPayload = (
  value: unknown,
): value is PlaylistSaveProgressPayload => {
  return (
    isPlainObject(value) &&
    isFiniteNumber(value.current) &&
    isFiniteNumber(value.total)
  );
};

export const isPlaylistFileLoadResult = (
  value: unknown,
): value is PlaylistFileLoadResult => {
  return (
    isPlainObject(value) &&
    isPlaylist(value.playlist) &&
    isString(value.filePath)
  );
};
