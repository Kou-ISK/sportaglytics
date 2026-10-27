/** Main-only export port. Renderer cannot choose a helper or assert qualification. */
export interface NativeClipExportRequest {
  sourcePath: string;
  start: number;
  duration: number;
  /** Index among the selected source's audio tracks; undefined keeps track zero. */
  audioTrack: number;
  outputPath: string;
  /** Main-owned cancellation; never accepted from renderer IPC. */
  signal?: AbortSignal;
}

export type NativeClipExportResult =
  | { status: 'completed' }
  | { status: 'fallback'; reason: string };

export type NativeClipExporter = (
  request: NativeClipExportRequest,
) => Promise<NativeClipExportResult>;
