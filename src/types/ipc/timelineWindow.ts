import type { HotkeyConfig } from '../settings/coreTypes';
import type {
  TimelineData,
  TimelineRow,
  TimelineRowSortSpec,
} from '../timeline/core';

export const TIMELINE_WINDOW_CHANNELS = {
  openWindow: 'timeline-window:open',
  closeWindow: 'timeline-window:close',
  isWindowOpen: 'timeline-window:is-open',
  syncToWindow: 'timeline-window:sync-to-window',
  sync: 'timeline-window:sync',
  clockToWindow: 'timeline-window:clock-to-window',
  clock: 'timeline-window:clock',
  command: 'timeline-window:command',
  visibility: 'timeline-window:visibility',
} as const;

export interface TimelineWindowSyncPayload {
  timeline: TimelineData[];
  rows: TimelineRow[];
  maxSec: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  selectedIds: string[];
  teamNames: string[];
  videoSources: string[];
  hotkeys: HotkeyConfig[];
  updatedAt: number;
}

export interface TimelineWindowClockPayload {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  updatedAt: number;
}

export type TimelineWindowCommand =
  | { type: 'request-sync' }
  | { type: 'seek'; time: number }
  | { type: 'selection-change'; ids: string[] }
  | { type: 'delete-items'; ids: string[] }
  | { type: 'update-memo'; id: string; memo: string }
  | { type: 'update-range'; id: string; startTime: number; endTime: number }
  | {
      type: 'update-item';
      id: string;
      updates: Partial<Omit<TimelineData, 'id'>>;
    }
  | {
      type: 'bulk-update-items';
      ids: string[];
      updates: Partial<Omit<TimelineData, 'id'>>;
    }
  | { type: 'duplicate-item'; id: string }
  | {
      type: 'create-item';
      actionName: string;
      startTime: number;
      endTime: number;
      color: string;
    }
  | { type: 'add-row'; name?: string; color?: string }
  | {
      type: 'update-row';
      id: string;
      updates: Pick<TimelineRow, 'name' | 'color'>;
    }
  | { type: 'move-row'; sourceId: string; targetId: string }
  | { type: 'sort-rows'; spec: TimelineRowSortSpec }
  | { type: 'delete-rows'; ids: string[] }
  | { type: 'paste-items'; items: TimelineData[]; targetRowId: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'add-to-playlist'; ids: string[] }
  | { type: 'hotkey-key-down'; hotkeyId: string }
  | { type: 'hotkey-key-up'; hotkeyId: string };

export interface ITimelineWindowAPI {
  openWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowOpen: () => Promise<boolean>;
  syncToWindow: (payload: TimelineWindowSyncPayload) => void;
  syncClockToWindow: (payload: TimelineWindowClockPayload) => void;
  sendCommand: (command: TimelineWindowCommand) => void;
  onSync: (
    callback: (payload: TimelineWindowSyncPayload) => void,
  ) => () => void;
  onClock: (
    callback: (payload: TimelineWindowClockPayload) => void,
  ) => () => void;
  onCommand: (callback: (command: TimelineWindowCommand) => void) => () => void;
  onVisibilityChange: (callback: (isOpen: boolean) => void) => () => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const isTimelineLabel = (value: unknown): boolean =>
  isObject(value) &&
  isString(value.name) &&
  (value.group === undefined || isString(value.group));

const isTimelineUpdates = (
  value: unknown,
): value is Partial<Omit<TimelineData, 'id'>> => {
  if (!isObject(value)) return false;
  const allowedKeys = new Set([
    'actionName',
    'startTime',
    'endTime',
    'memo',
    'labels',
    'color',
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return false;
  return (
    (value.actionName === undefined || isString(value.actionName)) &&
    (value.startTime === undefined || isNumber(value.startTime)) &&
    (value.endTime === undefined || isNumber(value.endTime)) &&
    (value.memo === undefined || isString(value.memo)) &&
    (value.labels === undefined ||
      (Array.isArray(value.labels) && value.labels.every(isTimelineLabel))) &&
    (value.color === undefined || isString(value.color))
  );
};

const isTimelineItem = (value: unknown): value is TimelineData =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.actionName) &&
  isNumber(value.startTime) &&
  isNumber(value.endTime) &&
  isString(value.memo) &&
  (value.labels === undefined ||
    (Array.isArray(value.labels) && value.labels.every(isTimelineLabel))) &&
  (value.color === undefined || isString(value.color));

const isTimelineRow = (value: unknown): value is TimelineRow =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.color);

const isHotkey = (value: unknown): value is HotkeyConfig =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.label) &&
  isString(value.key) &&
  (value.disabled === undefined || typeof value.disabled === 'boolean');

const isTimelineRowSortSpec = (value: unknown): value is TimelineRowSortSpec => {
  if (!isObject(value)) return false;
  if (
    value.criterion !== 'color' &&
    value.criterion !== 'name' &&
    value.criterion !== 'instanceCount'
  ) {
    return false;
  }
  if (value.criterion === 'color') {
    return value.direction === undefined;
  }
  return value.direction === 'asc' || value.direction === 'desc';
};

export const isTimelineWindowSyncPayload = (
  value: unknown,
): value is TimelineWindowSyncPayload =>
  isObject(value) &&
  Array.isArray(value.timeline) &&
  value.timeline.every(isTimelineItem) &&
  Array.isArray(value.rows) &&
  value.rows.every(isTimelineRow) &&
  isNumber(value.maxSec) &&
  isNumber(value.currentTime) &&
  typeof value.isPlaying === 'boolean' &&
  isNumber(value.playbackRate) &&
  isStringArray(value.selectedIds) &&
  isStringArray(value.teamNames) &&
  isStringArray(value.videoSources) &&
  Array.isArray(value.hotkeys) &&
  value.hotkeys.every(isHotkey) &&
  isNumber(value.updatedAt);

export const isTimelineWindowClockPayload = (
  value: unknown,
): value is TimelineWindowClockPayload =>
  isObject(value) &&
  isNumber(value.currentTime) &&
  typeof value.isPlaying === 'boolean' &&
  isNumber(value.playbackRate) &&
  isNumber(value.updatedAt);

export const isTimelineWindowCommand = (
  value: unknown,
): value is TimelineWindowCommand => {
  if (!isObject(value) || !isString(value.type)) return false;
  switch (value.type) {
    case 'request-sync':
    case 'undo':
    case 'redo':
      return true;
    case 'seek':
      return isNumber(value.time);
    case 'selection-change':
    case 'delete-items':
    case 'delete-rows':
    case 'add-to-playlist':
      return isStringArray(value.ids);
    case 'update-memo':
      return isString(value.id) && isString(value.memo);
    case 'update-range':
      return (
        isString(value.id) &&
        isNumber(value.startTime) &&
        isNumber(value.endTime)
      );
    case 'update-item':
      return isString(value.id) && isTimelineUpdates(value.updates);
    case 'bulk-update-items':
      return isStringArray(value.ids) && isTimelineUpdates(value.updates);
    case 'duplicate-item':
      return isString(value.id);
    case 'create-item':
      return (
        isString(value.actionName) &&
        isNumber(value.startTime) &&
        isNumber(value.endTime) &&
        isString(value.color)
      );
    case 'add-row':
      return (
        (value.name === undefined || isString(value.name)) &&
        (value.color === undefined || isString(value.color))
      );
    case 'update-row':
      return (
        isString(value.id) &&
        isObject(value.updates) &&
        isString(value.updates.name) &&
        isString(value.updates.color)
      );
    case 'move-row':
      return isString(value.sourceId) && isString(value.targetId);
    case 'sort-rows':
      return isTimelineRowSortSpec(value.spec);
    case 'paste-items':
      return (
        Array.isArray(value.items) &&
        value.items.every(isTimelineItem) &&
        isString(value.targetRowId)
      );
    case 'hotkey-key-down':
    case 'hotkey-key-up':
      return isString(value.hotkeyId);
    default:
      return false;
  }
};
