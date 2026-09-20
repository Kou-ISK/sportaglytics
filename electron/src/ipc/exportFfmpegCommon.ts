import type { ChromaKey } from '../../../src/shared/tactics/chromaKey';
import type { ExportMotionOverlay } from './exportMotionOverlays';
import type { ExportFreezeFrame } from './exportFreezeFrames';
import { runFfmpegProcess } from './exportFfmpegProcess';
export interface ExportClipForFfmpeg {
  chromaKey?: Partial<Record<'primary' | 'secondary', ChromaKey>>;
  hasAudio?: boolean;
  motionOverlays?: ExportMotionOverlay[];
  freezeFrames?: ExportFreezeFrame[];
  startTime: number;
  /** Local start of the second input when virtual timelines have different origins. */
  secondaryStartTime?: number;
  endTime: number;
  freezeAt?: number | null;
  freezeDuration?: number;
  sourceOverride?: string;
  secondarySourceOverride?: string;
}

export interface OverlayLine {
  text: string;
  isBold: boolean;
}

export interface RunSingleParams {
  getFfmpegPath: () => string;
  sourcePath: string;
  clip: ExportClipForFfmpeg;
  outputPath: string;
  overlayEnabled: boolean;
  overlayLines: OverlayLine[];
  annotationPath?: string | null;
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  onProgress?: (progress: number) => void;
}

export interface RunDualParams {
  getFfmpegPath: () => string;
  mainSource: string;
  secondarySource?: string | null;
  clip: ExportClipForFfmpeg;
  outputPath: string;
  overlayEnabled: boolean;
  overlayLines: OverlayLine[];
  annotationPrimary?: string | null;
  annotationSecondary?: string | null;
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  onProgress?: (progress: number) => void;
}

export const runWithOptionalProgress = (
  getFfmpegPath: () => string,
  args: string[],
  durationSeconds: number,
  onProgress?: (progress: number) => void,
): Promise<void> =>
  onProgress
    ? runFfmpegProcess(getFfmpegPath, args, {
        durationSeconds,
        onProgress,
      })
    : runFfmpegProcess(getFfmpegPath, args);
