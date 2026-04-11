import type { AnalysisDashboard } from '../../../../../../types/Settings';
import { normalizeDashboardList } from '../../../../../../types/Settings';

interface ParseAnalysisDashboardImportContentParams {
  content: string;
  existingDashboards: AnalysisDashboard[];
  generateDashboardId: () => string;
}

interface AnalysisDashboardImportResult {
  nextDashboards: AnalysisDashboard[];
  nextActiveId: string;
}

const INVALID_FORMAT_MESSAGE = 'ダッシュボード形式のJSONではありません。';
const IMPORT_FAILURE_MESSAGE = 'インポートに失敗しました。';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractImportedDashboards = (
  value: unknown,
  generateDashboardId: () => string,
): AnalysisDashboard[] => {
  if (!isPlainObject(value)) {
    return [];
  }

  if (Array.isArray(value.dashboards)) {
    return normalizeDashboardList(value.dashboards);
  }

  if (value.dashboard !== undefined) {
    return normalizeDashboardList([value.dashboard]);
  }

  if (Array.isArray(value.widgets)) {
    return normalizeDashboardList([
      {
        id: generateDashboardId(),
        name: 'インポート',
        widgets: value.widgets,
      },
    ]);
  }

  return [];
};

const ensureUniqueDashboardIds = (
  existingDashboards: AnalysisDashboard[],
  importedDashboards: AnalysisDashboard[],
  generateDashboardId: () => string,
): AnalysisDashboard[] => {
  const existingIds = new Set(existingDashboards.map((dashboard) => dashboard.id));

  return importedDashboards.map((dashboard, index) => {
    const baseId = dashboard.id || generateDashboardId();
    let nextId = baseId;
    let counter = 1;

    while (existingIds.has(nextId)) {
      nextId = `${baseId}-${counter}`;
      counter += 1;
    }

    existingIds.add(nextId);
    return {
      ...dashboard,
      id: nextId,
      name: dashboard.name.trim() || `インポート${index + 1}`,
      widgets: Array.isArray(dashboard.widgets) ? dashboard.widgets : [],
    };
  });
};

export const buildAnalysisDashboardExportContent = (
  activeDashboard: AnalysisDashboard,
): string => {
  return JSON.stringify(
    {
      version: 1,
      dashboard: activeDashboard,
    },
    null,
    2,
  );
};

export const parseAnalysisDashboardImportContent = ({
  content,
  existingDashboards,
  generateDashboardId,
}: ParseAnalysisDashboardImportContentParams): AnalysisDashboardImportResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(IMPORT_FAILURE_MESSAGE);
  }

  const importedDashboards = extractImportedDashboards(parsed, generateDashboardId);
  if (importedDashboards.length === 0) {
    throw new Error(INVALID_FORMAT_MESSAGE);
  }

  const normalizedDashboards = ensureUniqueDashboardIds(
    existingDashboards,
    importedDashboards,
    generateDashboardId,
  );

  return {
    nextDashboards: [...existingDashboards, ...normalizedDashboards],
    nextActiveId: normalizedDashboards[0].id,
  };
};
