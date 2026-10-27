import type { NativePlaybackFailure } from '../../../../../../../src/types/ipc/nativePlaybackFailure';

export interface NativeCapture {
  host: number;
  rendererFailure(value: NativePlaybackFailure): void;
  surfaceStage(event: number, id: number): void;
  note(kind: string, value?: Record<string, unknown>): void;
  data(bytes: Buffer): boolean;
  end(): void;
  exit(code?: number | null, signal?: NodeJS.Signals | null): void;
  error(): void;
}
export interface NativeRecorder {
  beginHost(): NativeCapture | null;
  done(): Promise<void>;
}
export function createRecorder(
  directory: string,
  dependencies?: {
    onStatus?: (status: number) => void;
  },
): NativeRecorder | null;
