import type {
  EventDetectionMetric,
  EventDetectionEvaluationBasis,
  EventDetectionModelInfo,
  EventDetectionModelStatus,
  RugbyEventType,
} from '../../../src/types/eventDetection/core';

export interface EventDetectionRunnerManifest {
  path: string;
  sha256: string;
}

export interface EventDetectionModelManifest {
  schemaVersion: 1 | 2;
  id: string;
  version: string;
  displayName: string;
  status: EventDetectionModelStatus;
  evaluationBasis: EventDetectionEvaluationBasis;
  events: RugbyEventType[];
  metrics: Partial<Record<RugbyEventType, EventDetectionMetric>>;
  runners: Record<string, EventDetectionRunnerManifest>;
}

export interface RunnableEventDetectionModel {
  info: EventDetectionModelInfo;
  modelDirectory: string;
  runnerPath: string;
  runnerSha256: string;
}
