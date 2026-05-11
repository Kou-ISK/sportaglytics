import { describe, expect, it, vi } from 'vitest';
import type { AnalysisDashboard } from '../../../../../../types/settings/coreTypes';
import {
  buildAnalysisDashboardExportContent,
  parseAnalysisDashboardImportContent,
} from './analysisDashboardImportExportService';

const existingDashboards: AnalysisDashboard[] = [
  {
    id: 'existing-dashboard',
    name: '既存',
    widgets: [],
  },
];

describe('analysisDashboardImportExportService', () => {
  it('builds dashboard export content', () => {
    const content = buildAnalysisDashboardExportContent(existingDashboards[0]);
    const parsed = JSON.parse(content) as {
      version: number;
      dashboard: AnalysisDashboard;
    };

    expect(parsed.version).toBe(1);
    expect(parsed.dashboard.id).toBe('existing-dashboard');
  });

  it('parses a single dashboard payload', () => {
    const result = parseAnalysisDashboardImportContent({
      content: JSON.stringify({
        dashboard: {
          id: 'imported-dashboard',
          name: 'Imported',
          widgets: [],
        },
      }),
      existingDashboards,
      generateDashboardId: vi.fn(() => 'generated-dashboard'),
    });

    expect(result.nextActiveId).toBe('imported-dashboard');
    expect(result.nextDashboards).toHaveLength(2);
  });

  it('renames duplicate dashboard ids on import', () => {
    const result = parseAnalysisDashboardImportContent({
      content: JSON.stringify({
        dashboards: [
          {
            id: 'existing-dashboard',
            name: 'Imported',
            widgets: [],
          },
        ],
      }),
      existingDashboards,
      generateDashboardId: vi.fn(() => 'generated-dashboard'),
    });

    expect(result.nextActiveId).toBe('existing-dashboard-1');
    expect(result.nextDashboards[1]?.id).toBe('existing-dashboard-1');
  });

  it('builds a dashboard from legacy widgets payload', () => {
    const result = parseAnalysisDashboardImportContent({
      content: JSON.stringify({
        widgets: [],
      }),
      existingDashboards,
      generateDashboardId: vi.fn(() => 'generated-dashboard'),
    });

    expect(result.nextActiveId).toBe('generated-dashboard');
    expect(result.nextDashboards[1]?.name).toBe('インポート');
  });
});
