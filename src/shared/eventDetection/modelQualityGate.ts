import type {
  EventDetectionMetric,
  RugbyEventType,
} from '../../types/eventDetection/core';

export const EVENT_DETECTION_QUALITY_GATE = {
  minPrecision: 0.95,
  minRecall: 0.9,
  minEvaluatedMatches: 5,
  minTimestampWithinTwoSecondsRate: 0.9,
} as const;

export const passesEventDetectionQualityGate = (
  metric: EventDetectionMetric | undefined,
): boolean => {
  if (!metric) return false;
  return (
    Number.isFinite(metric.precision) &&
    metric.precision >= EVENT_DETECTION_QUALITY_GATE.minPrecision &&
    Number.isFinite(metric.recall) &&
    metric.recall >= EVENT_DETECTION_QUALITY_GATE.minRecall &&
    Number.isInteger(metric.evaluatedMatches) &&
    metric.evaluatedMatches >= EVENT_DETECTION_QUALITY_GATE.minEvaluatedMatches &&
    typeof metric.timestampWithinTwoSecondsRate === 'number' &&
    Number.isFinite(metric.timestampWithinTwoSecondsRate) &&
    metric.timestampWithinTwoSecondsRate >=
      EVENT_DETECTION_QUALITY_GATE.minTimestampWithinTwoSecondsRate
  );
};

export const getVerifiedEventTypes = (
  events: RugbyEventType[],
  metrics: Partial<Record<RugbyEventType, EventDetectionMetric>>,
): RugbyEventType[] => {
  return events.filter((eventType) =>
    passesEventDetectionQualityGate(metrics[eventType]),
  );
};
