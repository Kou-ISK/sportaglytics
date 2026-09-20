import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { usesVirtualClipTimeline } from '../../../src/types/package/clipTimeline';
import { readMediaTimeline } from './mediaTimelineSource';
import { composeExportTimelineRange } from './exportTimelineComposition';
import { findDirectExportSource } from './exportTimelineRange';
import type {
  ExportTimelineClip,
  ExportTimeRange,
} from './exportTimelineRange';

export interface ExportSourcePlan {
  sourcePath: string;
  clips?: ExportTimelineClip[];
  offsetSeconds?: number;
}

export const planExportSource = async (
  sourcePath: string,
): Promise<ExportSourcePlan> => {
  const timeline = await readMediaTimeline(sourcePath);
  if (
    !timeline ||
    (!usesVirtualClipTimeline(timeline.clips) && timeline.offsetSeconds === 0)
  )
    return { sourcePath };
  return {
    sourcePath,
    offsetSeconds: timeline.offsetSeconds,
    clips: timeline.clips.map((clip) => ({
      id: clip.id,
      sourcePath: clip.source,
      timelineStartSeconds: clip.timelineStartSeconds,
      durationSeconds: clip.durationSeconds,
    })),
  };
};

export const materializeExportSource = async (
  plan: ExportSourcePlan,
  tempFiles: string[],
  range: ExportTimeRange,
  onProgress: (fraction: number) => void,
): Promise<{ sourcePath: string; timeOrigin: number }> => {
  if (!plan.clips) return { sourcePath: plan.sourcePath, timeOrigin: 0 };
  const direct = findDirectExportSource(
    plan.clips,
    plan.offsetSeconds ?? 0,
    range,
  );
  if (direct) return direct;
  const outputPath = path.join(
    os.tmpdir(),
    `sportaglytics-export-timeline-${randomUUID()}.mp4`,
  );
  tempFiles.push(outputPath);
  await composeExportTimelineRange(
    plan.clips,
    plan.offsetSeconds ?? 0,
    range,
    outputPath,
    onProgress,
  );
  return { sourcePath: outputPath, timeOrigin: range.start };
};
