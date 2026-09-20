export interface ExportTimeRange {
  start: number;
  end: number;
}

export interface ExportTimelineClip {
  id: string;
  sourcePath: string;
  timelineStartSeconds: number;
  durationSeconds?: number;
}

export interface ExportTimelineSegment {
  sourcePath?: string;
  sourceStart: number;
  duration: number;
}

/** Translate only the requested shared-clock interval, preserving gaps as silence/black. */
export const buildExportTimelineSegments = (
  clips: Array<ExportTimelineClip & { durationSeconds: number }>,
  offset: number,
  range: ExportTimeRange,
): ExportTimelineSegment[] => {
  if (
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end) ||
    range.start < 0 ||
    range.end <= range.start ||
    !Number.isFinite(offset)
  ) {
    throw new Error('書き出し区間を確認してください');
  }
  const segments: ExportTimelineSegment[] = [];
  let cursor = range.start;
  for (const clip of [...clips].sort(
    (a, b) => a.timelineStartSeconds - b.timelineStartSeconds,
  )) {
    const globalStart = clip.timelineStartSeconds - offset;
    const start = Math.max(range.start, globalStart);
    const end = Math.min(range.end, globalStart + clip.durationSeconds);
    if (end <= start) continue;
    if (start < cursor - 0.001) throw new Error('CLIP_TIMELINE_OVERLAP');
    if (start > cursor)
      segments.push({ sourceStart: 0, duration: start - cursor });
    segments.push({
      sourcePath: clip.sourcePath,
      sourceStart: start - globalStart,
      duration: end - start,
    });
    cursor = end;
  }
  if (cursor < range.end)
    segments.push({ sourceStart: 0, duration: range.end - cursor });
  return segments;
};

export const findDirectExportSource = (
  clips: ExportTimelineClip[],
  offset: number,
  range: ExportTimeRange,
): { sourcePath: string; timeOrigin: number } | null => {
  const clip = clips.find((candidate) => {
    const start = candidate.timelineStartSeconds - offset;
    return (
      candidate.durationSeconds !== undefined &&
      start <= range.start &&
      start + candidate.durationSeconds >= range.end
    );
  });
  return clip
    ? {
        sourcePath: clip.sourcePath,
        timeOrigin: clip.timelineStartSeconds - offset,
      }
    : null;
};
