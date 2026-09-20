import type { ExportClipsPayload } from './exportHandlers.types';
import type { ExportSourcePlan } from './exportVirtualTimelineSource';
import { materializeExportSource } from './exportVirtualTimelineSource';
import {
  getClipExportSources,
  resolveExportSourceSelection,
} from './exportSourceSelection';
import { findDirectExportSource } from './exportTimelineRange';
import type { ExportTimeRange } from './exportTimelineRange';

export interface ExportPreparationJob {
  plan: ExportSourcePlan;
  range: ExportTimeRange;
  weight: number;
}

export const buildExportPreparationJobs = (
  payload: ExportClipsPayload,
  plans: ExportSourcePlan[],
): ExportPreparationJob[] => {
  const selection = resolveExportSourceSelection(payload);
  return plans.map((plan) => {
    const relevant = payload.clips.filter((clip) =>
      getClipExportSources(clip, selection).includes(plan.sourcePath),
    );
    const range = relevant.reduce(
      (current, clip) => ({
        start: Math.min(current.start, clip.startTime),
        end: Math.max(current.end, clip.endTime, clip.startTime + 0.5),
      }),
      { start: Infinity, end: 0 },
    );
    const direct =
      !plan.clips ||
      findDirectExportSource(plan.clips, plan.offsetSeconds ?? 0, range);
    return { plan, range, weight: direct ? 0 : range.end - range.start };
  });
};

export const prepareExportSources = async (
  jobs: ExportPreparationJob[],
  tempFiles: string[],
  onStage: (fraction: number, weight: number, message: string) => void,
  onComplete: (weight: number, message: string) => void,
): Promise<{
  sources: Map<string, string>;
  timeOrigins: Map<string, number>;
}> => {
  const sources = new Map<string, string>();
  const timeOrigins = new Map<string, number>();
  for (const [index, job] of jobs.entries()) {
    const message = `映像 ${index + 1} / ${jobs.length} の同期区間を準備中...`;
    onStage(0, job.weight, message);
    const result = await materializeExportSource(
      job.plan,
      tempFiles,
      job.range,
      (fraction) => onStage(fraction, job.weight, message),
    );
    sources.set(job.plan.sourcePath, result.sourcePath);
    timeOrigins.set(result.sourcePath, result.timeOrigin);
    onComplete(job.weight, message);
  }
  return { sources, timeOrigins };
};
