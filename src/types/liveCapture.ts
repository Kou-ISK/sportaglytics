import type { PackageMediaAngle } from './package/media';

export type CaptureInput =
  | { id: string; name: string; kind: 'device' }
  | { id: string; name: string; kind: 'network'; url: string };

export interface CaptureStartRequest {
  name: string;
  inputs: CaptureInput[];
  quality: '1080p' | '720p';
}

export type CaptureInputPhase =
  | 'connecting'
  | 'recording'
  | 'disconnected'
  | 'stopped';

export interface CaptureInputStatus {
  id: string;
  name: string;
  kind: CaptureInput['kind'];
  phase: CaptureInputPhase;
  recordedSeconds: number;
  segmentCount: number;
  message?: string;
}

/** Only local recorded media is published. Connection URLs and device IDs stay private. */
export interface CaptureSnapshot {
  id: string;
  packagePath: string;
  name: string;
  phase: 'recording' | 'stopping' | 'completed' | 'error';
  elapsedSeconds: number;
  availableEndSeconds: number;
  inputs: CaptureInputStatus[];
  mediaAngles: PackageMediaAngle[];
  message?: string;
}

export interface CaptureChunk {
  sessionId: string;
  inputId: string;
  sequence: number;
  data: Uint8Array;
}

export interface CaptureTimelineState {
  availableEndSeconds: number;
  following: boolean;
  interrupted: boolean;
}

export interface ILiveCaptureAPI {
  open: () => Promise<void>;
  authorizeDevices: () => Promise<void>;
  capabilities: () => Promise<{ network: boolean }>;
  start: (request: CaptureStartRequest) => Promise<CaptureSnapshot | null>;
  append: (chunk: CaptureChunk) => Promise<void>;
  endInput: (sessionId: string, inputId: string) => Promise<void>;
  retry: (sessionId: string, inputId: string) => Promise<void>;
  stop: (sessionId: string) => Promise<void>;
  getState: () => Promise<CaptureSnapshot | null>;
  onState: (callback: (state: CaptureSnapshot | null) => void) => () => void;
  onStopRequest: (callback: () => void) => () => void;
}
