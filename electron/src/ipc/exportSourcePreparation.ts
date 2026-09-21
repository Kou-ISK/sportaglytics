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
  clipIndexes: number[];
}

export interface PreparedExportSource {
  sourcePath: string;
  timeOrigin: number;
}

export type PreparedExportSources = ReadonlyMap<
  number,
  ReadonlyMap<string, PreparedExportSource>
>;

export const buildExportPreparationJobs = (
  payload: ExportClipsPayload,
  plans: ExportSourcePlan[],
): ExportPreparationJob[] => {
  const selection = resolveExportSourceSelection(payload);
  const jobs: ExportPreparationJob[] = [];
  for (const plan of plans) {
    const ranges = new Map<string, ExportPreparationJob>();
    for (const [clipIndex, clip] of payload.clips.entries()) {
      if (!getClipExportSources(clip, selection).includes(plan.sourcePath))
        continue;
      const range = {
        start: clip.startTime,
        end: Math.max(clip.endTime, clip.startTime + 0.5),
      };
      const key = JSON.stringify(range);
      const previous = ranges.get(key);
      if (previous) {
        previous.clipIndexes.push(clipIndex);
        continue;
      }
      const direct =
        !plan.clips ||
        findDirectExportSource(plan.clips, plan.offsetSeconds ?? 0, range);
      const job = {
        plan,
        range,
        weight: direct ? 0 : range.end - range.start,
        clipIndexes: [clipIndex],
      };
      ranges.set(key, job);
      jobs.push(job);
    }
  }
  return jobs;
};

export const prepareExportSources = async (
  jobs: ExportPreparationJob[],
  tempFiles: string[],
  onStage: (fraction: number, weight: number, message: string) => void,
  onComplete: (weight: number, message: string) => void,
): Promise<PreparedExportSources> => {
  const clips = new Map<number, Map<string, PreparedExportSource>>();
  for (const [index, job] of jobs.entries()) {
    const message = `映像 ${index + 1} / ${jobs.length} の同期区間を準備中...`;
    onStage(0, job.weight, message);
    const result = await materializeExportSource(
      job.plan,
      tempFiles,
      job.range,
      (fraction) => onStage(fraction, job.weight, message),
    );
    for (const clipIndex of job.clipIndexes) {
      const sources =
        clips.get(clipIndex) ?? new Map<string, PreparedExportSource>();
      sources.set(job.plan.sourcePath, result);
      clips.set(clipIndex, sources);
    }
    onComplete(job.weight, message);
  }
  return clips;
};
