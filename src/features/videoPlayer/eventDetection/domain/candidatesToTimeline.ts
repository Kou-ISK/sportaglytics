import type {
  EventDetectionCandidate,
  EventTimelineMapping,
} from '../../../../types/eventDetection/core';
import type {
  NewTimelineData,
  TimelineData,
} from '../../../../types/timeline/core';
import { resolveRecordingRange } from '../../components/Controls/domain/recordingRange';

export interface CandidateConversionResult {
  items: NewTimelineData[];
  skippedDisabled: number;
  skippedLowConfidence: number;
  skippedDuplicate: number;
}

interface ConvertCandidatesParams {
  candidates: EventDetectionCandidate[];
  mappings: EventTimelineMapping[];
  existingTimeline: TimelineData[];
  maxTime?: number;
  duplicateToleranceSeconds?: number;
}

const getCenterTime = (item: Pick<TimelineData, 'startTime' | 'endTime'>) =>
  (item.startTime + item.endTime) / 2;

const getIntersectionOverUnion = (
  left: Pick<TimelineData, 'startTime' | 'endTime'>,
  right: Pick<TimelineData, 'startTime' | 'endTime'>,
): number => {
  const intersection = Math.max(
    0,
    Math.min(left.endTime, right.endTime) -
      Math.max(left.startTime, right.startTime),
  );
  const union =
    Math.max(left.endTime, right.endTime) -
    Math.min(left.startTime, right.startTime);
  return union > 0 ? intersection / union : 0;
};

export const isDuplicateDetectedEvent = (
  candidate: NewTimelineData,
  existing: Pick<TimelineData, 'actionName' | 'startTime' | 'endTime'>,
  toleranceSeconds = 2,
): boolean => {
  if (candidate.actionName !== existing.actionName) return false;

  const centerDistance = Math.abs(
    getCenterTime(candidate) - getCenterTime(existing),
  );
  if (centerDistance <= Math.max(0, toleranceSeconds)) return true;

  return getIntersectionOverUnion(candidate, existing) >= 0.5;
};

const candidateToTimelineItem = (
  candidate: EventDetectionCandidate,
  mapping: EventTimelineMapping,
  maxTime?: number,
): NewTimelineData => {
  const hasDetectedRange =
    typeof candidate.detectedStartTime === 'number' &&
    Number.isFinite(candidate.detectedStartTime) &&
    typeof candidate.detectedEndTime === 'number' &&
    Number.isFinite(candidate.detectedEndTime);
  const range = resolveRecordingRange({
    startTime: hasDetectedRange
      ? (candidate.detectedStartTime as number)
      : candidate.anchorTime,
    endTime: hasDetectedRange
      ? (candidate.detectedEndTime as number)
      : candidate.anchorTime,
    leadTimeSeconds: mapping.leadTimeSeconds,
    lagTimeSeconds: mapping.lagTimeSeconds,
    maxTime,
  });

  return {
    actionName: mapping.actionName,
    startTime: range.startTime,
    endTime: range.endTime,
    memo: '',
  };
};

/**
 * Converts verified detector output into ordinary timeline instances.
 * Detector provenance intentionally stays outside TimelineData; after import,
 * detected events behave exactly like manually coded events.
 */
export const convertCandidatesToTimeline = ({
  candidates,
  mappings,
  existingTimeline,
  maxTime,
  duplicateToleranceSeconds = 2,
}: ConvertCandidatesParams): CandidateConversionResult => {
  const mappingByEvent = new Map(
    mappings.map((mapping) => [mapping.eventType, mapping]),
  );
  const accepted: NewTimelineData[] = [];
  let skippedDisabled = 0;
  let skippedLowConfidence = 0;
  let skippedDuplicate = 0;

  const sortedCandidates = [...candidates].sort(
    (left, right) => left.anchorTime - right.anchorTime,
  );

  for (const candidate of sortedCandidates) {
    const mapping = mappingByEvent.get(candidate.eventType);
    if (!mapping?.enabled || !mapping.actionName.trim()) {
      skippedDisabled += 1;
      continue;
    }
    if (
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < mapping.minConfidence
    ) {
      skippedLowConfidence += 1;
      continue;
    }
    if (!Number.isFinite(candidate.anchorTime) || candidate.anchorTime < 0) {
      skippedLowConfidence += 1;
      continue;
    }

    const item = candidateToTimelineItem(candidate, mapping, maxTime);
    const existingPool: Array<
      Pick<TimelineData, 'actionName' | 'startTime' | 'endTime'>
    > = [...existingTimeline, ...accepted];
    if (
      existingPool.some((existing) =>
        isDuplicateDetectedEvent(item, existing, duplicateToleranceSeconds),
      )
    ) {
      skippedDuplicate += 1;
      continue;
    }

    accepted.push(item);
  }

  return {
    items: accepted,
    skippedDisabled,
    skippedLowConfidence,
    skippedDuplicate,
  };
};
