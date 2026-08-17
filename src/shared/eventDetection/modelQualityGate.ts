import type {
  EventDetectionMetric,
  RugbyEventType,
} from '../../types/eventDetection/core';

export const EVENT_DETECTION_QUALITY_GATE = {
  minRecall: 0.95,
  minEvaluatedMatches: 5,
} as const;

export const passesEventDetectionQualityGate = (
  metric: EventDetectionMetric | undefined,
): boolean => {
  if (!metric) return false;
  return (
    Number.isFinite(metric.precision) &&
    metric.precision >= 0 &&
    metric.precision <= 1 &&
    Number.isFinite(metric.recall) &&
    metric.recall >= EVENT_DETECTION_QUALITY_GATE.minRecall &&
    Number.isInteger(metric.evaluatedMatches) &&
    metric.evaluatedMatches >= EVENT_DETECTION_QUALITY_GATE.minEvaluatedMatches &&
    Number.isFinite(metric.confidenceThreshold) &&
    metric.confidenceThreshold >= 0 &&
    metric.confidenceThreshold <= 1
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
