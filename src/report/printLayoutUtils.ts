import type { MatrixAxisConfig } from '../types/MatrixConfig';
import type { TimelineData } from '../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
} from '../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../utils/matrixBuilder';
import {
  deriveMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from '../shared/analysis/matrixFilterUtils';
import type {
  AnalysisReportMatrixSection,
  DashboardReportPage,
  DashboardWidgetReportData,
} from './types';

type Header = { parent: string | null; child: string };

interface PaginateDashboardWidgetsOptions {
  firstPageMaxRows?: number;
  nextPageMaxRows?: number;
}

interface CompactMatrixWithOthersOptions {
  rowHeaders: Header[];
  columnHeaders: Header[];
  values: number[][];
  maxRows?: number;
  maxColumns?: number;
}

interface BuildMatrixSectionsByTeamActionOptions {
  timeline: TimelineData[];
  rowAxis: MatrixAxisConfig;
  columnAxis: MatrixAxisConfig;
  filters: MatrixFilterState;
  maxTables?: number;
  maxRows?: number;
  maxColumns?: number;
}

const toHeaderLabel = (header: Header): string =>
  header.parent ? `${header.parent} > ${header.child}` : header.child;

const buildParentSpans = (headers: Header[]): Map<string, number> => {
  const spans = new Map<string, number>();
  headers.forEach((header) => {
    if (!header.parent) return;
    spans.set(header.parent, (spans.get(header.parent) ?? 0) + 1);
  });
  return spans;
};

const toSpanList = (source: Map<string, number>) =>
  Array.from(source.entries()).map(([key, span]) => ({ key, span }));

const pickTopIndices = (
  totals: number[],
  labels: string[],
  maxItems: number,
): { selected: number[]; hidden: number[] } => {
  if (totals.length === 0) {
    return { selected: [], hidden: [] };
  }

  const normalizedMax = Math.max(1, Math.floor(maxItems));
  const requiresOthers = totals.length > normalizedMax;
  const keepCount = requiresOthers
    ? Math.max(0, normalizedMax - 1)
    : normalizedMax;

  const ranked = totals
    .map((total, index) => ({ index, total, label: labels[index] ?? '' }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.label.localeCompare(b.label) ||
        a.index - b.index,
    );

  const selected = ranked
    .slice(0, keepCount)
    .map((item) => item.index)
    .sort((a, b) => a - b);
  const selectedSet = new Set(selected);
  const hidden = totals
    .map((_, index) => index)
    .filter((index) => !selectedSet.has(index));

  return { selected, hidden };
};

const sumCells = (
  values: number[][],
  rowIndices: number[],
  columnIndices: number[],
): number => {
  let total = 0;
  rowIndices.forEach((rowIndex) => {
    const row = values[rowIndex] ?? [];
    columnIndices.forEach((columnIndex) => {
      const value = row[columnIndex] ?? 0;
      total += Number.isFinite(value) ? value : 0;
    });
  });
  return total;
};

export const compactMatrixWithOthers = ({
  rowHeaders,
  columnHeaders,
  values,
  maxRows = 12,
  maxColumns = 12,
}: CompactMatrixWithOthersOptions) => {
  const safeValues = values.map((row) =>
    row.map((value) => (Number.isFinite(value) ? value : 0)),
  );

  const rowTotals = rowHeaders.map((_, rowIndex) =>
    (safeValues[rowIndex] ?? []).reduce((sum, value) => sum + value, 0),
  );
  const columnTotals = columnHeaders.map((_, columnIndex) =>
    safeValues.reduce((sum, row) => sum + (row[columnIndex] ?? 0), 0),
  );

  const rowLabels = rowHeaders.map(toHeaderLabel);
  const columnLabels = columnHeaders.map(toHeaderLabel);
  const pickedRows = pickTopIndices(rowTotals, rowLabels, maxRows);
  const pickedColumns = pickTopIndices(columnTotals, columnLabels, maxColumns);

  const selectedRows = pickedRows.selected;
  const selectedColumns = pickedColumns.selected;
  const hiddenRows = pickedRows.hidden;
  const hiddenColumns = pickedColumns.hidden;

  const rowSelectors = [...selectedRows];
  if (hiddenRows.length > 0) rowSelectors.push(-1);

  const columnSelectors = [...selectedColumns];
  if (hiddenColumns.length > 0) columnSelectors.push(-1);

  const compactValues = rowSelectors.map((rowSelector) =>
    columnSelectors.map((columnSelector) => {
      if (rowSelector >= 0 && columnSelector >= 0) {
        return safeValues[rowSelector]?.[columnSelector] ?? 0;
      }

      if (rowSelector >= 0) {
        return sumCells(safeValues, [rowSelector], hiddenColumns);
      }

      if (columnSelector >= 0) {
        return sumCells(safeValues, hiddenRows, [columnSelector]);
      }

      return sumCells(safeValues, hiddenRows, hiddenColumns);
    }),
  );

  const compactRowHeaders = selectedRows
    .map(
      (rowIndex) => rowHeaders[rowIndex] ?? { parent: null, child: '未設定' },
    )
    .concat(hiddenRows.length > 0 ? [{ parent: null, child: 'その他' }] : []);
  const compactColumnHeaders = selectedColumns
    .map(
      (columnIndex) =>
        columnHeaders[columnIndex] ?? { parent: null, child: '未設定' },
    )
    .concat(
      hiddenColumns.length > 0 ? [{ parent: null, child: 'その他' }] : [],
    );

  return {
    rowHeaders: compactRowHeaders,
    columnHeaders: compactColumnHeaders,
    rowParentSpans: buildParentSpans(compactRowHeaders),
    colParentSpans: buildParentSpans(compactColumnHeaders),
    rowLabels: compactRowHeaders.map(toHeaderLabel),
    columnLabels: compactColumnHeaders.map(toHeaderLabel),
    values: compactValues,
  };
};

const buildRowsFromWidgets = (
  widgets: DashboardWidgetReportData[],
): DashboardWidgetReportData[][] => {
  const rows: DashboardWidgetReportData[][] = [];
  let currentRow: DashboardWidgetReportData[] = [];
  let currentWidth = 0;

  widgets.forEach((widget) => {
    const span = Math.max(1, Math.min(12, widget.colSpan));
    if (currentRow.length > 0 && currentWidth + span > 12) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }

    currentRow.push(widget);
    currentWidth += span;

    if (currentWidth >= 12) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
};

export const paginateDashboardWidgets = (
  widgets: DashboardWidgetReportData[],
  options: PaginateDashboardWidgetsOptions = {},
): DashboardReportPage[] => {
  const { firstPageMaxRows = 2, nextPageMaxRows = 3 } = options;
  const rows = buildRowsFromWidgets(widgets);
  if (rows.length === 0) {
    return [];
  }

  const pages: DashboardReportPage[] = [];
  let cursor = 0;
  let pageIndex = 0;

  while (cursor < rows.length) {
    const maxRows = pageIndex === 0 ? firstPageMaxRows : nextPageMaxRows;
    const rowCount = Math.max(1, maxRows);
    const pageRows = rows.slice(cursor, cursor + rowCount);
    pages.push({
      pageIndex: pageIndex + 1,
      rowCount: pageRows.length,
      widgets: pageRows.flat(),
    });
    cursor += pageRows.length;
    pageIndex += 1;
  }

  return pages;
};

export const buildMatrixSectionsByTeamAction = ({
  timeline,
  rowAxis,
  columnAxis,
  filters,
  maxTables = 10,
  maxRows = 12,
  maxColumns = 12,
}: BuildMatrixSectionsByTeamActionOptions): AnalysisReportMatrixSection[] => {
  const baseFilters: MatrixFilterState = {
    ...filters,
    team: MATRIX_FILTER_ALL,
    action: MATRIX_FILTER_ALL,
  };
  const baseDerived = deriveMatrixFilters(timeline, baseFilters);
  const baseTimeline = baseDerived.filteredTimeline;

  if (baseTimeline.length === 0) {
    return [];
  }

  const fixedTeam = filters.team !== MATRIX_FILTER_ALL ? filters.team : null;
  const fixedAction =
    filters.action !== MATRIX_FILTER_ALL ? filters.action : null;

  const comboAgg = new Map<
    string,
    { team: string; action: string; count: number }
  >();
  baseTimeline.forEach((entry) => {
    const team = extractTeamFromActionName(entry.actionName);
    const action = extractActionFromActionName(entry.actionName);
    if (fixedTeam && team !== fixedTeam) return;
    if (fixedAction && action !== fixedAction) return;
    const key = `${team}|||${action}`;
    const current = comboAgg.get(key) ?? { team, action, count: 0 };
    current.count += 1;
    comboAgg.set(key, current);
  });

  const sortedCombos = Array.from(comboAgg.values()).sort(
    (a, b) =>
      b.count - a.count ||
      a.team.localeCompare(b.team) ||
      a.action.localeCompare(b.action),
  );

  if (sortedCombos.length === 0) {
    return [];
  }

  const normalizedMaxTables = Math.max(1, Math.floor(maxTables));
  const includeOthers = sortedCombos.length > normalizedMaxTables;
  const keepCount = includeOthers
    ? Math.max(0, normalizedMaxTables - 1)
    : sortedCombos.length;
  const primaryCombos = sortedCombos.slice(0, keepCount);
  const otherCombos = sortedCombos.slice(keepCount);
  const otherKeySet = new Set(
    otherCombos.map((combo) => `${combo.team}|||${combo.action}`),
  );

  const createSection = (
    title: string,
    filterKey: string,
    sectionTimeline: TimelineData[],
    isOthersBucket: boolean,
  ): AnalysisReportMatrixSection => {
    const matrix = buildHierarchicalMatrix(
      sectionTimeline,
      rowAxis,
      columnAxis,
    );
    const matrixValues = matrix.matrix.map((row) =>
      row.map((cell) => cell.count),
    );
    const compacted = compactMatrixWithOthers({
      rowHeaders: matrix.rowHeaders,
      columnHeaders: matrix.columnHeaders,
      values: matrixValues,
      maxRows,
      maxColumns,
    });

    return {
      title,
      filterKey,
      rowHeaders: compacted.rowHeaders,
      columnHeaders: compacted.columnHeaders,
      rowParentSpans: toSpanList(compacted.rowParentSpans),
      colParentSpans: toSpanList(compacted.colParentSpans),
      values: compacted.values,
      visibleCount: sectionTimeline.length,
      totalCount: baseTimeline.length,
      isOthersBucket,
    };
  };

  const sections: AnalysisReportMatrixSection[] = primaryCombos.map((combo) => {
    const sectionTimeline = baseTimeline.filter((entry) => {
      const team = extractTeamFromActionName(entry.actionName);
      const action = extractActionFromActionName(entry.actionName);
      return team === combo.team && action === combo.action;
    });
    return createSection(
      `${combo.team} / ${combo.action}`,
      `${combo.team}|||${combo.action}`,
      sectionTimeline,
      false,
    );
  });

  if (otherCombos.length > 0) {
    const otherTimeline = baseTimeline.filter((entry) => {
      const team = extractTeamFromActionName(entry.actionName);
      const action = extractActionFromActionName(entry.actionName);
      return otherKeySet.has(`${team}|||${action}`);
    });
    sections.push(
      createSection(
        `その他 (${otherCombos.length} combinations)`,
        '__others__',
        otherTimeline,
        true,
      ),
    );
  }

  return sections;
};
