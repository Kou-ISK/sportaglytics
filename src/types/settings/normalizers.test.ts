import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  createDefaultCodeWindowLayout,
  createRugbyLabelsCodeWindowLayout,
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
            buttons: [
              {
                ...legacyLayout.buttons[0],
                hotkey: 'A',
                showHotkey: true,
                leadTimeSeconds: 5,
                lagTimeSeconds: 3,
              },
            ],
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
                  labelGroup: 'actionResult',
                },
                primaryAxis: { type: 'group', value: 'actionType' },
                seriesAxis: { type: 'group', value: 'actionResult' },
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
    expect(
      normalized.codingPanel?.codeWindows?.some(
        (layout) => layout.id === 'rugby-labels',
      ),
    ).toBe(true);
    const migratedButton = normalized.codingPanel?.codeWindows?.find(
      (layout) => layout.id === 'legacy-layout',
    )?.buttons[0];
    expect(migratedButton?.showHotkey).toBe(true);
    expect(migratedButton?.leadTimeSeconds).toBe(5);
    expect(migratedButton?.lagTimeSeconds).toBe(3);

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
    expect(customWidget?.widgetFilters?.labelGroup).toBe('Result');
    expect(customWidget?.primaryAxis).toEqual({ type: 'group', value: 'Type' });
    expect(customWidget?.seriesAxis).toEqual({
      type: 'group',
      value: 'Result',
    });
  });

  it('drops invalid negative recording range settings', () => {
    const layout = createDefaultCodeWindowLayout();
    const normalized = normalizeAppSettings({
      codingPanel: {
        codeWindows: [
          {
            ...layout,
            id: 'invalid-range-layout',
            buttons: [
              {
                ...layout.buttons[0],
                leadTimeSeconds: -1,
                lagTimeSeconds: -3,
              },
            ],
          },
        ],
        activeCodeWindowId: 'invalid-range-layout',
      },
    });

    const button = normalized.codingPanel?.codeWindows?.find(
      (candidate) => candidate.id === 'invalid-range-layout',
    )?.buttons[0];
    expect(button?.leadTimeSeconds).toBeUndefined();
    expect(button?.lagTimeSeconds).toBeUndefined();
  });

  it('provides a rugby labels code window preset ordered by Type then Result', () => {
    const preset = createRugbyLabelsCodeWindowLayout();
    const firstTypeIndex = preset.buttons.findIndex(
      (button) => button.name === 'Type',
    );
    const firstResultIndex = preset.buttons.findIndex(
      (button) => button.name === 'Result',
    );

    expect(preset.id).toBe('rugby-labels');
    expect(firstTypeIndex).toBeGreaterThanOrEqual(0);
    expect(firstResultIndex).toBeGreaterThan(firstTypeIndex);
    expect(new Set(preset.buttons.map((button) => button.name))).toEqual(
      new Set(['Type', 'Result']),
    );
  });

  it('migrates legacy jump-back shortcuts to continuous reverse playback defaults', () => {
    const normalized = normalizeAppSettings({
      hotkeys: [
        { id: 'skip-backward-medium', label: '5秒戻し', key: 'Left' },
        { id: 'skip-backward-large', label: '10秒戻し', key: 'Shift+Left' },
      ],
    });

    expect(
      normalized.hotkeys.some((hotkey) =>
        hotkey.id.startsWith('skip-backward-'),
      ),
    ).toBe(false);
    expect(
      normalized.hotkeys
        .filter((hotkey) => hotkey.id.startsWith('reverse-playback-'))
        .map(({ id, key }) => ({ id, key })),
    ).toEqual([
      { id: 'reverse-playback-slow', key: 'Left' },
      { id: 'reverse-playback-2x', key: 'Shift+Left' },
      { id: 'reverse-playback-4x', key: 'Option+Left' },
      { id: 'reverse-playback-6x', key: 'Command+Left' },
    ]);
  });
});
