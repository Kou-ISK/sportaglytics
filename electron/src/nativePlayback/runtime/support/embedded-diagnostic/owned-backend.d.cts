import type { QualifiedNativeSource } from '../../../nativePlaybackManager';
import type { NativeCapture } from '../recurrence/recorder.cjs';
import type { NativePlaybackClosed } from '../../../../../../../src/types/ipc/nativePlayback';

export interface OwnedBackend {
  factory: QualifiedNativeSource['createBackend'];
  cancel(): Promise<NativePlaybackClosed | void>;
  done(): Promise<NativePlaybackClosed> | null;
  pid(): number | undefined;
}
export function createOwnedBackend(options: {
  manifest: Record<string, unknown>;
  run: string;
  host: string;
  note: (kind: string, value?: Record<string, unknown>) => void;
  surfaceReady: (id: number) => void;
  recurrence?: NativeCapture | null;
}): OwnedBackend;
