import { describe, expect, it } from 'vitest';
import {
  createDefaultAnalysisDashboard,
  createTemplateDashboardWidgets,
} from './defaults';
import {
  normalizeAnalysisDashboard,
  normalizeDashboardList,
} from './dashboardNormalizers';

describe('built-in dashboard normalization compatibility', () => {
  it('keeps the exact built-in canonical while retaining edits and valid metrics on its copies', () => {
    const widgets = createTemplateDashboardWidgets().map((widget) => ({
      ...widget,
      title: `合成編集 ${widget.title}`,
    }));
    const normalized = normalizeAnalysisDashboard({
      dashboards: [
        { id: 'template-basic', name: '基本分析テンプレート', widgets },
        { id: 'template-basic-1', name: '合成コピー', widgets },
      ],
      activeDashboardId: 'template-basic-1',
    });
    expect(normalized.dashboards[0].widgets).toEqual(
      createTemplateDashboardWidgets(),
    );
    expect(normalized.dashboards[1].widgets).toEqual(widgets);
    expect(
      normalizeAnalysisDashboard(JSON.parse(JSON.stringify(normalized))),
    ).toEqual(normalized);
  });

  it('keeps default-dashboard removal, template insertion and legacy label migration', () => {
    const widget = createTemplateDashboardWidgets()[1];
    const normalized = normalizeAnalysisDashboard({
      dashboards: [
        { id: 'default', name: '旧既定', widgets: [widget] },
        {
          id: 'legacy-custom',
          name: '合成の旧設定',
          widgets: [
            {
              ...widget,
              metric: 'count',
              primaryAxis: { type: 'group', value: 'actionResult' },
              widgetFilters: {
                team: 'Synthetic',
                teamRole: 'team1',
                action: 'キック',
                labelGroup: 'actionType',
              },
            },
          ],
        },
      ],
      activeDashboardId: 'legacy-custom',
    });
    expect(normalized.dashboards.map((dashboard) => dashboard.id)).toEqual([
      'legacy-custom',
      'template-basic',
    ]);
    expect(normalized.activeDashboardId).toBe('legacy-custom');
    expect(normalized.dashboards[0].widgets[0]).toMatchObject({
      metric: 'count',
      primaryAxis: { type: 'group', value: 'Result' },
      widgetFilters: {
        teamRole: 'team1',
        action: 'キック',
        labelGroup: 'Type',
      },
    });
    expect(
      normalized.dashboards[0].widgets[0].widgetFilters?.team,
    ).toBeUndefined();
  });

  it('retains fallback behavior for malformed metrics and legacy singleton settings', () => {
    expect(
      normalizeDashboardList([
        {
          id: 'synthetic',
          name: '合成',
          widgets: [
            { ...createTemplateDashboardWidgets()[0], metric: 'invalid' },
          ],
        },
      ])[0].widgets[0].metric,
    ).toBe('duration');
    expect(
      normalizeAnalysisDashboard({ widgets: createTemplateDashboardWidgets() }),
    ).toEqual(createDefaultAnalysisDashboard());
    expect(normalizeAnalysisDashboard({ dashboards: [] })).toEqual(
      createDefaultAnalysisDashboard(),
    );
  });
});
