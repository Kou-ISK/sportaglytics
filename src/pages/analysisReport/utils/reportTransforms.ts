import type { TimelineData } from '../../../types/TimelineData';
import type {
  AnalysisReportMatrixSection,
  AnalysisReportPayload,
} from '../../../report/types';

const MAX_MOMENTUM_SEGMENTS_PER_PAGE = 60;

export const toMatrixCells = (values: number[][]) =>
  values.map((row) =>
    row.map((count) => ({
      count,
      entries: [] as TimelineData[],
    })),
  );

export const toSpanMap = (items: Array<{ key: string; span: number }>) =>
  new Map(items.map((item) => [item.key, item.span]));

export const chunkMomentumSegments = (
  segments: AnalysisReportPayload['momentum']['segments'],
) => {
  if (segments.length <= MAX_MOMENTUM_SEGMENTS_PER_PAGE) {
    return [segments];
  }

  const chunks: (typeof segments)[] = [];
  for (
    let start = 0;
    start < segments.length;
    start += MAX_MOMENTUM_SEGMENTS_PER_PAGE
  ) {
    chunks.push(segments.slice(start, start + MAX_MOMENTUM_SEGMENTS_PER_PAGE));
  }
  return chunks;
};

export const fallbackMatrixSections = (
  payload: AnalysisReportPayload,
): AnalysisReportMatrixSection[] => [
  {
    title: payload.matrix.title,
    filterKey: 'fallback',
    rowHeaders: payload.matrix.rowHeaders,
    columnHeaders: payload.matrix.columnHeaders,
    rowParentSpans: payload.matrix.rowParentSpans,
    colParentSpans: payload.matrix.colParentSpans,
    values: payload.matrix.values,
    visibleCount: payload.matrix.visibleCount,
    totalCount: payload.matrix.totalCount,
    isOthersBucket: false,
  },
];
