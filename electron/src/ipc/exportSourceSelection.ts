import type {
  ClipExportItem,
  ExportClipsPayload,
} from './exportHandlers.types';
import { normalizeAngleOption, resolveDualSourceError } from './exportOptions';

export interface ExportSourceSelection {
  mainSource: string;
  secondarySource?: string | null;
  useDual: boolean;
}

export const resolveExportSourceSelection = (
  payload: ExportClipsPayload,
): ExportSourceSelection => {
  const angle = normalizeAngleOption(payload.angleOption, payload.mode);
  const secondarySource =
    angle === 'allAngles' || angle === 'multi' || payload.mode === 'dual'
      ? payload.sourcePath2
      : undefined;
  return {
    mainSource:
      angle === 'angle2'
        ? payload.sourcePath2 || payload.sourcePath
        : payload.sourcePath,
    secondarySource,
    useDual:
      payload.mode === 'dual' || angle === 'multi' || Boolean(secondarySource),
  };
};

export const getClipExportSources = (
  clip: ClipExportItem,
  selection: ExportSourceSelection,
): string[] => {
  const main = clip.videoSource || selection.mainSource;
  const secondary = clip.videoSource2 || selection.secondarySource;
  if (clip.angleType === 'angle2') return [secondary || main];
  if (clip.angleType === 'angle1' || !selection.useDual) return [main];
  const error = resolveDualSourceError(main, secondary);
  if (error || !secondary) throw new Error(error || '第2ソースがありません');
  return [main, secondary];
};
