/** Original detector output, not a claim about the current edited range. */
export interface TimelineDetectionSource {
  origin: 'event-detection';
  requestId: string;
  modelId: string;
  modelVersion: string;
  candidateId: string;
  eventType: string;
  confidence: number;
  anchorTime: number;
}

/** Absent provenance means unknown origin/review, including legacy/manual data. */
export interface TimelineProvenance {
  // A detection, edit, copy or merge is never evidence of human review.
  reviewStatus: 'unreviewed';
  sources: TimelineDetectionSource[];
  /** A merge also included an entry without recorded provenance. */
  hasUnknownSource: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isSource = (value: unknown): value is TimelineDetectionSource =>
  isRecord(value) &&
  value.origin === 'event-detection' &&
  isText(value.requestId) &&
  isText(value.modelId) &&
  isText(value.modelVersion) &&
  isText(value.candidateId) &&
  isText(value.eventType) &&
  typeof value.confidence === 'number' &&
  Number.isFinite(value.confidence) &&
  value.confidence >= 0 &&
  value.confidence <= 1 &&
  typeof value.anchorTime === 'number' &&
  Number.isFinite(value.anchorTime) &&
  value.anchorTime >= 0;

export const isTimelineProvenance = (
  value: unknown,
): value is TimelineProvenance =>
  isRecord(value) &&
  value.reviewStatus === 'unreviewed' &&
  typeof value.hasUnknownSource === 'boolean' &&
  Array.isArray(value.sources) &&
  value.sources.length > 0 &&
  value.sources.every(isSource);
