import type {
  EventDetectionCandidate,
  EventDetectionResult,
  EventTimelineMapping,
} from '../../../../types/eventDetection/core';
import type {
  NewTimelineData,
  TimelineData,
} from '../../../../types/timeline/core';
import type { TimelineProvenance } from '../../../../types/timeline/provenance';
import { isTimelineProvenance } from '../../../../types/timeline/provenance';
import { resolveRecordingRange } from '../../components/Controls/domain/recordingRange';

export interface CandidateConversionResult {
  items: NewTimelineData[];
  skippedDisabled: number;
  skippedLowConfidence: number;
  skippedDuplicate: number;
}

interface ConvertCandidatesParams {
  source: Pick<EventDetectionResult, 'requestId' | 'modelId' | 'modelVersion'>;
  candidates: EventDetectionCandidate[];
  mappings: EventTimelineMapping[];
  existingTimeline: TimelineData[];
  maxTime?: number;
  duplicateToleranceSeconds?: number;
}

const getCenterTime = (
  item: Pick<TimelineData, 'startTime' | 'endTime'>,
): number => (item.startTime + item.endTime) / 2;

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

const getDetectedBaseRange = (
  candidate: EventDetectionCandidate,
): { startTime: number; endTime: number } => {
  const startTime = candidate.detectedStartTime;
  const endTime = candidate.detectedEndTime;
  if (
    typeof startTime === 'number' &&
    Number.isFinite(startTime) &&
    typeof endTime === 'number' &&
    Number.isFinite(endTime)
  ) {
    return { startTime, endTime };
  }

  return {
    startTime: candidate.anchorTime,
    endTime: candidate.anchorTime,
  };
};

const candidateToTimelineItem = (
  candidate: EventDetectionCandidate,
  mapping: EventTimelineMapping,
  source: ConvertCandidatesParams['source'],
  maxTime?: number,
): NewTimelineData => {
  const baseRange = getDetectedBaseRange(candidate);
  const range = resolveRecordingRange({
    ...baseRange,
    leadTimeSeconds: mapping.leadTimeSeconds,
    lagTimeSeconds: mapping.lagTimeSeconds,
    maxTime,
  });

  const provenance: TimelineProvenance = {
    reviewStatus: 'unreviewed',
    hasUnknownSource: false,
    sources: [
      {
        origin: 'event-detection',
        requestId: source.requestId,
        modelId: source.modelId,
        modelVersion: source.modelVersion,
        candidateId: candidate.id,
        eventType: candidate.eventType,
        confidence: candidate.confidence,
        anchorTime: candidate.anchorTime,
      },
    ],
  };
  // The runner contract historically allowed empty IDs. Do not save metadata
  // that the document loader would later reject, or substitute invented IDs.
  if (!isTimelineProvenance(provenance)) {
    throw new Error(
      '検出結果の由来情報が不正です。タイムラインには追加していません。',
    );
  }
  return {
    actionName: mapping.actionName,
    startTime: range.startTime,
    endTime: range.endTime,
    memo: '',
    provenance,
  };
};

/**
 * Converts detector output into ordinary timeline instances.
 * Retains original detector output without treating import or editing as review.
 */
export const convertCandidatesToTimeline = ({
  source,
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
    (left, right) =>
      right.confidence - left.confidence || left.anchorTime - right.anchorTime,
  );

  for (const candidate of sortedCandidates) {
    const mapping = mappingByEvent.get(candidate.eventType);
    if (!mapping?.enabled || !mapping.actionName.trim()) {
      skippedDisabled += 1;
      continue;
    }
    if (
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1 ||
      candidate.confidence < mapping.minConfidence
    ) {
      skippedLowConfidence += 1;
      continue;
    }
    if (!Number.isFinite(candidate.anchorTime) || candidate.anchorTime < 0) {
      skippedLowConfidence += 1;
      continue;
    }

    const item = candidateToTimelineItem(candidate, mapping, source, maxTime);
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
    items: accepted.sort((left, right) => left.startTime - right.startTime),
    skippedDisabled,
    skippedLowConfidence,
    skippedDuplicate,
  };
};
