import type {
  EventDetectionMetric,
  EventDetectionModelInfo,
  RugbyEventType,
} from '../../../src/types/eventDetection/core';

export interface EventDetectionRunnerManifest {
  path: string;
  sha256: string;
}

export interface EventDetectionModelManifest {
  schemaVersion: 1;
  id: string;
  version: string;
  displayName: string;
  status: 'verified' | 'experimental';
  events: RugbyEventType[];
  metrics: Partial<Record<RugbyEventType, EventDetectionMetric>>;
  runners: Record<string, EventDetectionRunnerManifest>;
}

export interface VerifiedEventDetectionModel {
  info: EventDetectionModelInfo;
  modelDirectory: string;
  runnerPath: string;
  runnerSha256: string;
}
