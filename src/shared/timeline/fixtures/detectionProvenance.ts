import type { TimelineProvenance } from '../../../types/timeline/provenance';

/** Entirely synthetic contract data; scores are not model evaluation results. */
export const detectionProvenance: TimelineProvenance = {
  reviewStatus: 'unreviewed',
  hasUnknownSource: false,
  sources: [
    {
      origin: 'event-detection',
      requestId: 'synthetic-run',
      modelId: 'synthetic-model',
      modelVersion: '1-experimental',
      candidateId: 'synthetic-candidate',
      eventType: 'scrum',
      confidence: 0.9,
      anchorTime: 4,
    },
  ],
};
