import { isTimelineProvenance } from '../../types/timeline/provenance';
import type { TimelineData } from '../../types/timeline/core';
import type {
  TimelineDetectionSource,
  TimelineProvenance,
} from '../../types/timeline/provenance';

/** Reject malformed claims instead of silently losing them during a save. */
export const parseTimelineProvenance = (
  value: unknown,
): TimelineProvenance | undefined => {
  if (value === undefined) return undefined;
  if (!isTimelineProvenance(value)) {
    throw new Error(
      'タイムラインの検出由来・確認状態が不正です。原本は変更していません。',
    );
  }
  return {
    reviewStatus: 'unreviewed',
    hasUnknownSource: value.hasUnknownSource,
    sources: value.sources.map((source) => ({
      origin: source.origin,
      requestId: source.requestId,
      modelId: source.modelId,
      modelVersion: source.modelVersion,
      candidateId: source.candidateId,
      eventType: source.eventType,
      confidence: source.confidence,
      anchorTime: source.anchorTime,
    })),
  };
};

export const copyTimelineProvenance = (
  provenance: TimelineProvenance | undefined,
): TimelineProvenance | undefined =>
  provenance
    ? {
        ...provenance,
        sources: provenance.sources.map((source) => ({ ...source })),
      }
    : undefined;

export const mergeTimelineProvenance = (
  items: Pick<TimelineData, 'provenance'>[],
): TimelineProvenance | undefined => {
  if (items.every((item) => !item.provenance)) return undefined;
  const sources = new Map<string, TimelineDetectionSource>();
  for (const item of items) {
    for (const source of item.provenance?.sources ?? []) {
      sources.set(JSON.stringify(source), { ...source });
    }
  }
  return {
    reviewStatus: 'unreviewed',
    sources: [...sources.values()],
    hasUnknownSource: items.some(
      (item) => !item.provenance || item.provenance.hasUnknownSource,
    ),
  };
};
