import type {
  EventDetectionModelInfo,
  EventDetectionModelStatus,
  EventDetectionProgress,
  EventTimelineMapping,
  RugbyEventType,
} from '../eventDetection/core';
import {
  isEventDetectionModelInfo,
  isEventDetectionModelStatus,
  isEventDetectionProgress,
  isRugbyEventType,
} from './eventDetection';
import { isPlainObject } from './shared';

export interface EventDetectionWindowState {
  open: boolean;
  loadingModels: boolean;
  models: EventDetectionModelInfo[];
  selectedModelKey: string;
  angleOptions: Array<{ id: string; name: string; localClipCount: number }>;
  selectedAngleId: string;
  mappings: EventTimelineMapping[];
  progress: EventDetectionProgress | null;
  running: boolean;
  error: string | null;
  summary: {
    added: number;
    duplicates: number;
    lowConfidence: number;
    modelStatus: EventDetectionModelStatus;
  } | null;
}
export type EventDetectionWindowCommand =
  | { type: 'run' | 'cancel' | 'close' }
  | { type: 'model'; key: string }
  | { type: 'angle'; id: string }
  | {
      type: 'mapping';
      eventType: RugbyEventType;
      updates: Partial<EventTimelineMapping>;
    };
export const EVENT_DETECTION_WINDOW_CHANNELS = {
  open: 'event-detection-window:open',
  hide: 'event-detection-window:hide',
  publish: 'event-detection-window:publish',
  state: 'event-detection-window:state',
  request: 'event-detection-window:request',
  command: 'event-detection-window:command',
} as const;
export interface IEventDetectionWindowAPI {
  open: () => Promise<void>;
  hide: () => Promise<void>;
  publish: (state: EventDetectionWindowState | null) => void;
  requestState: () => Promise<EventDetectionWindowState | null>;
  onState: (
    callback: (state: EventDetectionWindowState | null) => void,
  ) => () => void;
  command: (command: EventDetectionWindowCommand) => void;
  onCommand: (
    callback: (command: EventDetectionWindowCommand) => void,
  ) => () => void;
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 4096;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const range = (value: unknown, max: number): boolean =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max;
const mappingFields: Record<string, (value: unknown) => boolean> = {
  eventType: isRugbyEventType,
  actionName: text,
  enabled: (value) => typeof value === 'boolean',
  minConfidence: (value) => range(value, 1),
  leadTimeSeconds: (value) => range(value, 600),
  lagTimeSeconds: (value) => range(value, 600),
};
export const isEventDetectionWindowCommand = (
  value: unknown,
): value is EventDetectionWindowCommand => {
  if (!isPlainObject(value)) return false;
  switch (value.type) {
    case 'run':
    case 'cancel':
    case 'close':
      return true;
    case 'model':
      return text(value.key);
    case 'angle':
      return text(value.id);
    case 'mapping':
      return (
        isRugbyEventType(value.eventType) &&
        isPlainObject(value.updates) &&
        Object.entries(value.updates).every(
          ([key, item]) =>
            key !== 'eventType' &&
            Object.prototype.hasOwnProperty.call(mappingFields, key) &&
            Boolean(mappingFields[key]?.(item)),
        )
      );
    default:
      return false;
  }
};
export const isEventDetectionWindowState = (
  value: unknown,
): value is EventDetectionWindowState => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.open === 'boolean' &&
    typeof value.loadingModels === 'boolean' &&
    typeof value.running === 'boolean' &&
    text(value.selectedModelKey) &&
    text(value.selectedAngleId) &&
    (value.error === null || text(value.error)) &&
    Array.isArray(value.models) &&
    value.models.length <= 100 &&
    value.models.every(isEventDetectionModelInfo) &&
    Array.isArray(value.angleOptions) &&
    value.angleOptions.length <= 32 &&
    value.angleOptions.every(
      (angle: unknown) =>
        isPlainObject(angle) &&
        text(angle.id) &&
        text(angle.name) &&
        count(angle.localClipCount),
    ) &&
    Array.isArray(value.mappings) &&
    value.mappings.length <= 10 &&
    value.mappings.every(
      (mapping: unknown) =>
        isPlainObject(mapping) &&
        Object.entries(mappingFields).every(([key, check]) =>
          check(mapping[key]),
        ),
    ) &&
    (value.progress === null || isEventDetectionProgress(value.progress)) &&
    (value.summary === null ||
      (isPlainObject(value.summary) &&
        count(value.summary.added) &&
        count(value.summary.duplicates) &&
        count(value.summary.lowConfidence) &&
        isEventDetectionModelStatus(value.summary.modelStatus)))
  );
};
