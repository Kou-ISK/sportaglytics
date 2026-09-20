import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { usesVirtualClipTimeline } from '../../../src/types/package/clipTimeline';
import { readMediaTimeline } from './mediaTimelineSource';
import { recomposeLocalTimeline } from './packageMediaCompositionService';

export interface ExportSourcePlan {
  sourcePath: string;
  clips?: Parameters<typeof recomposeLocalTimeline>[0];
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
    })),
  };
};

export const materializeExportSource = async (
  plan: ExportSourcePlan,
  tempFiles: string[],
  minimumDuration = 0,
): Promise<string> => {
  if (!plan.clips) return plan.sourcePath;
  const outputPath = path.join(
    os.tmpdir(),
    `sportaglytics-export-timeline-${randomUUID()}.mp4`,
  );
  tempFiles.push(outputPath);
  await recomposeLocalTimeline(plan.clips, outputPath, {
    offsetSeconds: plan.offsetSeconds ?? 0,
    minimumDuration,
  });
  return outputPath;
};
