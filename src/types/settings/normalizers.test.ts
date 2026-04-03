import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../Settings';
import {
  createDefaultCodeWindowLayout,
  createTemplateDashboardWidgets,
} from './defaults';
import { normalizeAppSettings } from './normalizers';

describe('normalizeAppSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(normalizeAppSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeAppSettings('invalid')).toEqual(DEFAULT_SETTINGS);
  });

  it('absorbs legacy settings fields and fills missing sections', () => {
    const legacyLayout = createDefaultCodeWindowLayout();
    const templateWidget = createTemplateDashboardWidgets()[0];
    const normalized = normalizeAppSettings({
      themeMode: 'dark',
      hotkeys: [
        { id: 'undo', label: 'Custom Undo', key: 'Ctrl+Z' },
        { id: 'unknown-hotkey', label: 'Ignored', key: 'X' },
      ],
      overlayClip: {
        enabled: false,
      },
      aiAnalysis: {
        model: '',
        retrieverPreset: 'unexpected',
      },
      codingPanel: {
        defaultMode: 'label',
        layouts: [
          {
            ...legacyLayout,
            id: 'legacy-layout',
            name: 'Legacy Layout',
          },
        ],
        activeLayoutId: 'legacy-layout',
      },
      analysisDashboard: {
        dashboards: [
          {
            id: 'custom-dashboard',
            name: 'Custom Dashboard',
            widgets: [
              {
                ...templateWidget,
                id: 'custom-widget',
                title: 'Custom Widget',
                widgetFilters: {
                  team: 'TeamA',
                  action: 'Kick',
                },
              },
            ],
          },
        ],
        activeDashboardId: 'custom-dashboard',
      },
    });

    expect(normalized.themeMode).toBe('dark');
    expect(normalized.hotkeys.find((hotkey) => hotkey.id === 'undo')).toEqual({
      id: 'undo',
      label: 'Custom Undo',
      key: 'Ctrl+Z',
    });
    expect(
      normalized.hotkeys.some((hotkey) => hotkey.id === 'unknown-hotkey'),
    ).toBe(false);
    expect(normalized.hotkeys).toHaveLength(DEFAULT_SETTINGS.hotkeys.length);

    expect(normalized.overlayClip).toMatchObject({
      enabled: false,
      showActionName: true,
      showActionIndex: true,
      showLabels: true,
      showMemo: true,
    });

    expect(normalized.aiAnalysis?.model).toBe(
      DEFAULT_SETTINGS.aiAnalysis?.model,
    );
    expect(normalized.aiAnalysis?.retrieverPreset).toBe('balanced');

    expect(normalized.codingPanel?.activeCodeWindowId).toBe('legacy-layout');
    expect(
      normalized.codingPanel?.codeWindows?.some(
        (layout) => layout.id === 'legacy-layout',
      ),
    ).toBe(true);
    expect(
      normalized.codingPanel?.codeWindows?.some(
        (layout) => layout.id === 'default',
      ),
    ).toBe(true);

    expect(normalized.analysisDashboard?.activeDashboardId).toBe(
      'custom-dashboard',
    );
    expect(
      normalized.analysisDashboard?.dashboards.some(
        (dashboard) => dashboard.id === 'template-basic',
      ),
    ).toBe(true);
    const customWidget = normalized.analysisDashboard?.dashboards
      .find((dashboard) => dashboard.id === 'custom-dashboard')
      ?.widgets.find((widget) => widget.id === 'custom-widget');
    expect(customWidget?.widgetFilters?.team).toBeUndefined();
    expect(customWidget?.widgetFilters?.action).toBe('Kick');
  });
});
