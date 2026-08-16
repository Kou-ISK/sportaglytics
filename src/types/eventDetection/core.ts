export const RUGBY_EVENT_TYPES = [
  'restart',
  'scrum',
  'lineout',
  'maul',
  'goalKick',
] as const;

export type RugbyEventType = (typeof RUGBY_EVENT_TYPES)[number];

export interface EventDetectionMetric {
  precision: number;
  recall: number;
  evaluatedMatches: number;
  /** Confidence threshold used when the reported metrics were measured. */
  confidenceThreshold: number;
  timestampWithinTwoSecondsRate?: number;
}

export interface EventDetectionModelInfo {
  id: string;
  version: string;
  displayName: string;
  events: RugbyEventType[];
  status: 'verified';
  metrics: Partial<Record<RugbyEventType, EventDetectionMetric>>;
}

export interface EventDetectionClipInput {
  clipId: string;
  videoPath: string;
  timelineStartSeconds: number;
  durationSeconds?: number;
}

export interface EventDetectionRequest {
  requestId: string;
  modelId: string;
  modelVersion: string;
  events: RugbyEventType[];
  clips: EventDetectionClipInput[];
}

export interface EventDetectionCandidate {
  id: string;
  eventType: RugbyEventType;
  confidence: number;
  /** Global package timeline time for the event anchor. */
  anchorTime: number;
  /** Optional global package timeline bounds produced by the detector. */
  detectedStartTime?: number;
  detectedEndTime?: number;
  clipId?: string;
}

export interface EventDetectionResult {
  requestId: string;
  modelId: string;
  modelVersion: string;
  candidates: EventDetectionCandidate[];
  durationMs: number;
}

export interface EventDetectionProgress {
  requestId: string;
  stage: 'preparing' | 'analyzing' | 'finalizing';
  progress: number;
  message?: string;
}

export interface EventTimelineMapping {
  eventType: RugbyEventType;
  actionName: string;
  enabled: boolean;
  minConfidence: number;
  leadTimeSeconds: number;
  lagTimeSeconds: number;
}
