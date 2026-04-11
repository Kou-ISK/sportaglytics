import type { TimelineData } from '../../../../types/TimelineData';
import type { SCTimelineFile } from '../../../../types/SCTimeline';
import {
  exportToCSV,
  exportToJSON,
  importFromJSON,
} from '../../../../utils/timelineExport';
import {
  convertFromSCTimeline,
  convertToSCTimeline,
} from '../../../../utils/scTimelineConverter';

export type TimelineExportFormat = 'json' | 'csv' | 'sctimeline';

interface TimelineFileFilter {
  name: string;
  extensions: string[];
}

export interface TimelineExportPlan {
  content: string;
  defaultFileName: string;
  filters: TimelineFileFilter[];
  formatLabel: string;
}

interface TimelineImportResult {
  timeline: TimelineData[];
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasSctimelineRows = (value: unknown): value is SCTimelineFile => {
  if (!isRecord(value)) {
    return false;
  }

  const timeline = value.timeline;
  return isRecord(timeline) && Array.isArray(timeline.rows);
};

export const buildTimelineExportPlan = (
  format: string,
  timeline: TimelineData[],
): TimelineExportPlan | null => {
  switch (format) {
    case 'json':
      return {
        content: exportToJSON(timeline),
        defaultFileName: 'timeline.json',
        filters: [{ name: 'JSON形式', extensions: ['json'] }],
        formatLabel: 'JSON形式',
      };
    case 'csv':
      return {
        content: exportToCSV(timeline),
        defaultFileName: 'timeline.csv',
        filters: [{ name: 'CSV形式', extensions: ['csv'] }],
        formatLabel: 'CSV形式',
      };
    case 'sctimeline':
      return {
        content: JSON.stringify(convertToSCTimeline(timeline), null, 2),
        defaultFileName: 'SportscodeXML.SCTimeline',
        filters: [{ name: 'SCTimeline形式', extensions: ['SCTimeline'] }],
        formatLabel: 'SCTimeline形式',
      };
    default:
      return null;
  }
};

export const parseTimelineImportContent = (
  content: string,
): TimelineImportResult => {
  try {
    const timeline = importFromJSON(content);
    return {
      timeline,
      message: `タイムラインをインポートしました（${timeline.length}件）`,
    };
  } catch (jsonError: unknown) {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (!hasSctimelineRows(parsed)) {
        throw jsonError;
      }

      const timeline = convertFromSCTimeline(parsed);
      return {
        timeline,
        message: `SCTimeline形式のタイムラインをインポートしました（${timeline.length}件）`,
      };
    } catch {
      throw jsonError;
    }
  }
};
