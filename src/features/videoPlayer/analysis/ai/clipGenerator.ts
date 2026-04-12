import type { EvidenceItem, AiClipSegment, AiRecommendedClip } from './types';

const MERGE_OVERLAP_THRESHOLD = 0.35;
const MERGE_GAP_SECONDS = 2;

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
  options?: {
    sequences?: string[][];
    mergeOverlapRatio?: number;
    mergeGapSeconds?: number;
  },
): AiClipSegment[] => {
  const sequences = options?.sequences ?? [];
  const overlapThreshold =
    options?.mergeOverlapRatio ?? MERGE_OVERLAP_THRESHOLD;
  const gapThreshold = options?.mergeGapSeconds ?? MERGE_GAP_SECONDS;
  const rawSegments = recommendedClips
    .map((clip) => {
      const center = evidenceMap.get(clip.centerId);
      if (!center) return null;
      const startTime = Math.max(0, center.startTime - clip.preSeconds);
      const endTime = center.endTime + clip.postSeconds;
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
      let adjustedStart = startTime;
      let adjustedEnd = endTime;
      let evidenceIds = [...clip.evidenceIds];
      let reason = clip.reason;

      const sequence = sequences.find((seq) => seq.includes(clip.centerId));
      if (sequence) {
        const seqItems = sequence
          .map((id) => evidenceMap.get(id))
          .filter(Boolean) as EvidenceItem[];
        if (seqItems.length > 0) {
          const seqStart = Math.min(...seqItems.map((item) => item.startTime));
          const seqEnd = Math.max(...seqItems.map((item) => item.endTime));
          adjustedStart = Math.max(0, Math.min(adjustedStart, seqStart));
          adjustedEnd = Math.max(adjustedEnd, seqEnd);
          evidenceIds = Array.from(new Set([...evidenceIds, ...sequence]));
          reason = `${reason} / シーケンス全体を含めて確認`;
        }
      }

      return {
        startTime: adjustedStart,
        endTime: adjustedEnd,
        title: clip.title || center.actionName,
        centerIds: [clip.centerId],
        reason,
        evidenceIds,
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
    const gap = segment.startTime - last.endTime;
    if (overlapRatio >= overlapThreshold || gap <= gapThreshold) {
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
