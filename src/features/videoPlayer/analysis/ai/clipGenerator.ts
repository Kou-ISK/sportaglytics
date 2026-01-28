import type { EvidenceItem, AiClipSegment, AiRecommendedClip } from './types';

const MERGE_OVERLAP_THRESHOLD = 0.35;

const calculateOverlapRatio = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const minDuration = Math.min(aEnd - aStart, bEnd - bStart);
  if (minDuration <= 0) return 0;
  return overlap / minDuration;
};

export const buildClipSegments = (
  recommendedClips: AiRecommendedClip[],
  evidenceMap: Map<string, EvidenceItem>,
): AiClipSegment[] => {
  const rawSegments = recommendedClips
    .map((clip) => {
      const center = evidenceMap.get(clip.centerId);
      if (!center) return null;
      const startTime = Math.max(0, center.startTime - clip.preSeconds);
      const endTime = center.endTime + clip.postSeconds;
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
      return {
        startTime,
        endTime,
        title: clip.title || center.actionName,
        centerIds: [clip.centerId],
        reason: clip.reason,
        evidenceIds: clip.evidenceIds,
      };
    })
    .filter(Boolean) as AiClipSegment[];

  rawSegments.sort((a, b) => a.startTime - b.startTime);

  const merged: AiClipSegment[] = [];
  for (const segment of rawSegments) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(segment);
      continue;
    }
    const overlapRatio = calculateOverlapRatio(
      last.startTime,
      last.endTime,
      segment.startTime,
      segment.endTime,
    );
    if (overlapRatio >= MERGE_OVERLAP_THRESHOLD) {
      last.startTime = Math.min(last.startTime, segment.startTime);
      last.endTime = Math.max(last.endTime, segment.endTime);
      last.centerIds = Array.from(
        new Set([...last.centerIds, ...segment.centerIds]),
      );
      last.reason = `${last.reason} / ${segment.reason}`;
      last.evidenceIds = Array.from(
        new Set([...last.evidenceIds, ...segment.evidenceIds]),
      );
      if (!last.title.includes(segment.title)) {
        last.title = `${last.title} + ${segment.title}`;
      }
    } else {
      merged.push(segment);
    }
  }

  return merged;
};
