import type {
  TimelineData,
  TimelineDocument,
  TimelineRow,
} from '../../../../types/timeline/core';
import { normalizeTimelineData } from '../../../../utils/scTimelineConverter';
import { deriveTimelineRows, isTimelineRow } from '../../shared/timelineRows';

export interface ParsedTimelineDocument {
  timeline: TimelineData[];
  rows: TimelineRow[];
  snapshot: string;
}

export const serializeTimelineDocument = (
  timeline: TimelineData[],
  rows: TimelineRow[],
): string =>
  JSON.stringify({
    version: 2,
    rows,
    instances: timeline,
  } satisfies TimelineDocument);

export const parseTimelineDocument = (text: string): ParsedTimelineDocument => {
  const raw = JSON.parse(text) as unknown;
  const rawDocument =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : null;
  const rawInstances = Array.isArray(raw)
    ? raw
    : Array.isArray(rawDocument?.instances)
      ? rawDocument.instances
      : [];
  const timeline = rawInstances.map((item) => normalizeTimelineData(item));
  const rows = Array.isArray(rawDocument?.rows)
    ? rawDocument.rows.filter(isTimelineRow)
    : deriveTimelineRows(timeline);

  return {
    timeline,
    rows,
    snapshot: serializeTimelineDocument(timeline, rows),
  };
};
