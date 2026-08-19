import type {
  EventDetectionMetric,
  EventDetectionModelInfo,
  EventDetectionModelStatus,
  EventDetectionProgress,
  EventDetectionRequest,
  EventDetectionResult,
  RugbyEventType,
} from '../eventDetection/core';
import {
  EVENT_DETECTION_MODEL_STATUSES,
  RUGBY_EVENT_TYPES,
} from '../eventDetection/core';
import {
  isArrayOf,
  isFiniteNumber,
  isOptional,
  isPlainObject,
  isString,
} from './shared';

export const EVENT_DETECTION_CHANNELS = {
  listModels: 'event-detection:list-models',
  run: 'event-detection:run',
  cancel: 'event-detection:cancel',
  progress: 'event-detection:progress',
  openRequested: 'event-detection:open-requested',
} as const;

const EVENT_TYPE_SET = new Set<string>(RUGBY_EVENT_TYPES);
const MODEL_STATUS_SET = new Set<string>(EVENT_DETECTION_MODEL_STATUSES);

export interface IEventDetectionAPI {
  listModels: () => Promise<EventDetectionModelInfo[]>;
  run: (request: EventDetectionRequest) => Promise<EventDetectionResult>;
  cancel: (requestId: string) => Promise<boolean>;
  onProgress: (callback: (progress: EventDetectionProgress) => void) => void;
  offProgress: (callback: (progress: EventDetectionProgress) => void) => void;
  onOpenRequested: (callback: () => void) => () => void;
}

export const isRugbyEventType = (value: unknown): value is RugbyEventType =>
  typeof value === 'string' && EVENT_TYPE_SET.has(value);

export const isEventDetectionModelStatus = (
  value: unknown,
): value is EventDetectionModelStatus =>
  typeof value === 'string' && MODEL_STATUS_SET.has(value);

const isEventDetectionMetric = (value: unknown): value is EventDetectionMetric => {
  if (!isPlainObject(value)) return false;
  return (
    isFiniteNumber(value.precision) &&
    value.precision >= 0 &&
    value.precision <= 1 &&
    isFiniteNumber(value.recall) &&
    value.recall >= 0 &&
    value.recall <= 1 &&
    Number.isInteger(value.evaluatedMatches) &&
    typeof value.evaluatedMatches === 'number' &&
    value.evaluatedMatches >= 0 &&
    isFiniteNumber(value.confidenceThreshold) &&
    value.confidenceThreshold >= 0 &&
    value.confidenceThreshold <= 1 &&
    isOptional(
      value.timestampWithinTwoSecondsRate,
      (candidate): candidate is number =>
        isFiniteNumber(candidate) && candidate >= 0 && candidate <= 1,
    )
  );
};

export const isEventDetectionModelInfo = (
  value: unknown,
): value is EventDetectionModelInfo => {
  if (!isPlainObject(value)) return false;
  if (
    !isString(value.id) ||
    value.id.length === 0 ||
    !isString(value.version) ||
    value.version.length === 0 ||
    !isString(value.displayName) ||
    value.displayName.length === 0 ||
    !isEventDetectionModelStatus(value.status) ||
    !isArrayOf(value.events, isRugbyEventType) ||
    value.events.length === 0 ||
    !isPlainObject(value.metrics)
  ) {
    return false;
  }

  return Object.entries(value.metrics).every(
    ([eventType, metric]) =>
      isRugbyEventType(eventType) && isEventDetectionMetric(metric),
  );
};

export const isEventDetectionModelInfoList = (
  value: unknown,
): value is EventDetectionModelInfo[] =>
  isArrayOf(value, isEventDetectionModelInfo);

const isClipInput = (
  value: unknown,
): value is EventDetectionRequest['clips'][number] => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.clipId) &&
    isString(value.videoPath) &&
    value.videoPath.length > 0 &&
    isFiniteNumber(value.timelineStartSeconds) &&
    isOptional(value.durationSeconds, isFiniteNumber)
  );
};

export const isEventDetectionRequest = (
  value: unknown,
): value is EventDetectionRequest => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.requestId) &&
    value.requestId.length > 0 &&
    isString(value.modelId) &&
    value.modelId.length > 0 &&
    isString(value.modelVersion) &&
    value.modelVersion.length > 0 &&
    isArrayOf(value.events, isRugbyEventType) &&
    value.events.length > 0 &&
    isArrayOf(value.clips, isClipInput) &&
    value.clips.length > 0
  );
};

const isCandidate = (
  value: unknown,
): value is EventDetectionResult['candidates'][number] => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.id) &&
    isRugbyEventType(value.eventType) &&
    isFiniteNumber(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    isFiniteNumber(value.anchorTime) &&
    value.anchorTime >= 0 &&
    isOptional(value.detectedStartTime, isFiniteNumber) &&
    isOptional(value.detectedEndTime, isFiniteNumber) &&
    isOptional(value.clipId, isString)
  );
};

export const isEventDetectionResult = (
  value: unknown,
): value is EventDetectionResult => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.requestId) &&
    isString(value.modelId) &&
    isString(value.modelVersion) &&
    isArrayOf(value.candidates, isCandidate) &&
    isFiniteNumber(value.durationMs) &&
    value.durationMs >= 0
  );
};

export const isEventDetectionProgress = (
  value: unknown,
): value is EventDetectionProgress => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.requestId) &&
    (value.stage === 'preparing' ||
      value.stage === 'analyzing' ||
      value.stage === 'finalizing') &&
    isFiniteNumber(value.progress) &&
    value.progress >= 0 &&
    value.progress <= 1 &&
    isOptional(value.message, isString)
  );
};
