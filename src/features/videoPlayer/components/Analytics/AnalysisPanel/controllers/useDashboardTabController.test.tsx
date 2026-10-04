/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../../../../types/settings/coreTypes';
import {
  DEFAULT_SETTINGS,
  createTemplateDashboardWidgets,
} from '../../../../../../types/settings/defaults';
import { normalizeAppSettings } from '../../../../../../types/settings/normalizers';
import { buildAnalysisDashboardExportContent } from '../utils/analysisDashboardImportExportService';
import { useDashboardTabController } from './useDashboardTabController';

const mocks = vi.hoisted(() => ({
  load: vi.fn<() => Promise<AppSettings>>(),
  save: vi.fn<(settings: AppSettings) => Promise<boolean>>(),
  readImport: vi.fn<() => Promise<string | null>>(),
  externalOpen: vi.fn<(callback: (path: string) => void) => () => void>(
    () => () => {},
  ),
  notification: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    notify: vi.fn(),
  },
}));
vi.mock('../../../../../../contexts/NotificationContext', () => ({
  useNotification: () => mocks.notification,
}));
vi.mock('../../../../../../shared/settings/settingsGateway', () => ({
  loadAppSettings: mocks.load,
  saveAppSettings: mocks.save,
  resetAppSettings: vi.fn(),
  subscribeAppSettingsUpdated: () => () => {},
}));
vi.mock('../../../../app/gateways/analysisWindowGateway', () => ({
  subscribeAnalysisDashboardExternalOpen: mocks.externalOpen,
}));
vi.mock('../gateways/analysisDashboardGateway', () => ({
  canImportAnalysisDashboard: () => true,
  canExportAnalysisDashboard: () => true,
  requestAnalysisDashboardImportPath: async () => 'fixtures/synthetic.stad',
  readAnalysisDashboardImportContent: mocks.readImport,
  requestAnalysisDashboardExportPath: async () => null,
  writeAnalysisDashboardPackage: vi.fn(),
}));

const roundTrip = (value: unknown): AppSettings =>
  normalizeAppSettings(JSON.parse(JSON.stringify(value)));
let persisted: AppSettings;
const persist = async (settings: AppSettings): Promise<boolean> => {
  persisted = roundTrip(settings);
  return true;
};
const mount = async () => {
  const hook = renderHook(() =>
    useDashboardTabController({ timeline: [], teamNames: [] }),
  );
  await act(async () => {});
  return hook;
};
beforeEach(() => {
  vi.clearAllMocks();
  persisted = roundTrip(DEFAULT_SETTINGS);
  mocks.load.mockImplementation(async () => roundTrip(persisted));
  mocks.save.mockImplementation(persist);
  mocks.readImport.mockResolvedValue(null);
});
afterEach(cleanup);

const changeTitle = (
  hook: Awaited<ReturnType<typeof mount>>,
  title: string,
): void => {
  act(() =>
    hook.result.current.handleEditorSave({
      ...hook.result.current.widgets[0],
      title,
    }),
  );
};

describe('dashboard persistence contract', () => {
  it('protects the built-in and edits a saved copy without changing its count/duration metrics', async () => {
    const hook = await mount();
    const template = createTemplateDashboardWidgets();
    act(() => {
      hook.result.current.handleAddWidget();
      hook.result.current.openEditor(template[0]);
    });
    await act(async () => hook.result.current.handleSave());
    expect(hook.result.current.isEditing).toBe(false);
    expect(hook.result.current.editorOpen).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => hook.result.current.handleStartEdit());
    const copyId = hook.result.current.activeDashboardId;
    expect(copyId).not.toBe('template-basic');
    expect(hook.result.current.isEditing).toBe(true);
    expect(hook.result.current.widgets).toEqual(template);
    changeTitle(hook, '合成タイトル変更');
    await act(async () => hook.result.current.handleSave());
    expect(hook.result.current.isEditing).toBe(false);
    expect(mocks.notification.success).toHaveBeenLastCalledWith(
      'ダッシュボードを保存しました。',
    );
    hook.unmount();
    const reloaded = await mount();
    expect(reloaded.result.current.activeDashboardId).toBe(copyId);
    expect(reloaded.result.current.widgets[0].title).toBe('合成タイトル変更');
    expect(reloaded.result.current.widgets.map((w) => w.metric)).toEqual(
      template.map((w) => w.metric),
    );
    expect(
      reloaded.result.current.dashboards.find((d) => d.id === 'template-basic')
        ?.widgets,
    ).toEqual(template);
  });

  it('keeps ordinary duplicate behavior and cancels edits without writing the draft', async () => {
    const hook = await mount();
    await act(async () => hook.result.current.handleDuplicateDashboard());
    expect(hook.result.current.isEditing).toBe(false);
    const savedWidgets = hook.result.current.widgets;
    await act(async () => hook.result.current.handleStartEdit());
    changeTitle(hook, '破棄する編集');
    const writes = mocks.save.mock.calls.length;
    act(() => hook.result.current.handleCancelEdit());
    expect(hook.result.current.widgets).toEqual(savedWidgets);
    expect(mocks.save).toHaveBeenCalledTimes(writes);
    hook.unmount();
    expect((await mount()).result.current.widgets).toEqual(savedWidgets);
  });

  it('creates an empty dashboard, saves a count chart and restores it on reload', async () => {
    const hook = await mount();
    act(() => hook.result.current.setNewDashboardName('合成の新規分析'));
    await act(async () => hook.result.current.handleCreateDashboard());
    expect(hook.result.current.isEditing).toBe(true);
    act(() =>
      hook.result.current.handleEditorSave({
        ...createTemplateDashboardWidgets()[1],
        title: '合成回数',
      }),
    );
    await act(async () => hook.result.current.handleSave());
    hook.unmount();
    const reloaded = await mount();
    expect(reloaded.result.current.widgets).toHaveLength(1);
    expect(reloaded.result.current.widgets[0]).toMatchObject({
      title: '合成回数',
      metric: 'count',
    });
  });

  it('does not enter copy editing when saving fails; retry creates the copy', async () => {
    const hook = await mount();
    mocks.save.mockResolvedValueOnce(false);
    await act(async () => hook.result.current.handleStartEdit());
    expect(hook.result.current.activeDashboardId).toBe('template-basic');
    expect(hook.result.current.isEditing).toBe(false);
    expect(hook.result.current.saveError).toContain('保存できません');
    expect(mocks.notification.success).not.toHaveBeenCalled();
    await act(async () => hook.result.current.handleStartEdit());
    expect(hook.result.current.activeDashboardId).not.toBe('template-basic');
    expect(hook.result.current.isEditing).toBe(true);
    expect(hook.result.current.saveError).toBeNull();
  });

  it('retains a failed save draft and only reports success after retry succeeds', async () => {
    const hook = await mount();
    await act(async () => hook.result.current.handleStartEdit());
    changeTitle(hook, '保存待ちの編集');
    mocks.notification.success.mockClear();
    mocks.save.mockResolvedValueOnce(false);
    await act(async () => hook.result.current.handleSave());
    expect(hook.result.current.isEditing).toBe(true);
    expect(hook.result.current.widgets[0].title).toBe('保存待ちの編集');
    expect(hook.result.current.saveError).toContain('保存できません');
    expect(mocks.notification.success).not.toHaveBeenCalled();
    expect(
      persisted.analysisDashboard?.dashboards.find(
        (d) => d.id === hook.result.current.activeDashboardId,
      )?.widgets[0].title,
    ).not.toBe('保存待ちの編集');
    await act(async () => hook.result.current.handleSave());
    hook.unmount();
    expect((await mount()).result.current.widgets[0].title).toBe(
      '保存待ちの編集',
    );
  });

  it('keeps the create dialog and input on failure', async () => {
    const hook = await mount();
    act(() => {
      hook.result.current.setCreateDialogOpen(true);
      hook.result.current.setNewDashboardName('合成分析');
    });
    mocks.save.mockResolvedValueOnce(false);
    await act(async () => hook.result.current.handleCreateDashboard());
    expect(hook.result.current.createDialogOpen).toBe(true);
    expect(hook.result.current.newDashboardName).toBe('合成分析');
    expect(hook.result.current.activeDashboardId).toBe('template-basic');
    await act(async () => hook.result.current.handleCreateDashboard());
    expect(hook.result.current.createDialogOpen).toBe(false);
    expect(hook.result.current.activeDashboard?.name).toBe('合成分析');
  });

  it('retains the draft/discard dialog and delete dialog if those writes fail', async () => {
    const hook = await mount();
    await act(async () => hook.result.current.handleStartEdit());
    changeTitle(hook, '切替前の編集');
    const copyId = hook.result.current.activeDashboardId;
    await act(async () =>
      hook.result.current.handleDashboardChange('template-basic'),
    );
    mocks.save.mockResolvedValueOnce(false);
    await act(async () => hook.result.current.handleConfirmDiscardAndSwitch());
    expect(hook.result.current.activeDashboardId).toBe(copyId);
    expect(hook.result.current.isEditing).toBe(true);
    expect(hook.result.current.widgets[0].title).toBe('切替前の編集');
    expect(hook.result.current.discardDialogOpen).toBe(true);
    await act(async () => hook.result.current.handleConfirmDiscardAndSwitch());
    expect(hook.result.current.activeDashboardId).toBe('template-basic');
    expect(hook.result.current.isEditing).toBe(false);
    await act(async () => hook.result.current.handleDashboardChange(copyId));
    act(() => hook.result.current.handleRequestDeleteDashboard());
    mocks.save.mockResolvedValueOnce(false);
    await act(async () => hook.result.current.handleDeleteDashboard());
    expect(hook.result.current.deleteDialogOpen).toBe(true);
    expect(hook.result.current.activeDashboardId).toBe(copyId);
    await act(async () => hook.result.current.handleDeleteDashboard());
    expect(hook.result.current.deleteDialogOpen).toBe(false);
    expect(hook.result.current.activeDashboardId).toBe('template-basic');
  });

  it('serializes rapid copy requests and blocks editing during a pending save', async () => {
    const hook = await mount();
    let finish: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    mocks.save.mockImplementationOnce(async (settings) => {
      await gate;
      return persist(settings);
    });
    let first: Promise<void> | undefined;
    act(() => {
      first = hook.result.current.handleStartEdit();
    });
    expect(hook.result.current.isSaving).toBe(true);
    await act(async () => hook.result.current.handleStartEdit());
    act(() => hook.result.current.handleAddWidget());
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(hook.result.current.isEditing).toBe(false);
    expect(hook.result.current.editorOpen).toBe(false);
    await act(async () => {
      finish?.();
      await first;
    });
    expect(hook.result.current.dashboards).toHaveLength(2);
    expect(hook.result.current.isSaving).toBe(false);
    expect(hook.result.current.isEditing).toBe(true);
  });

  it('preserves copied title/metrics through export-import and treats a template-prefixed copy as editable', async () => {
    const hook = await mount();
    mocks.readImport.mockResolvedValue(
      buildAnalysisDashboardExportContent({
        id: 'template-basic-1',
        name: '合成インポート',
        widgets: createTemplateDashboardWidgets().map((w) => ({
          ...w,
          title: `編集済 ${w.title}`,
        })),
      }),
    );
    await act(async () => hook.result.current.handleImportDashboard());
    expect(hook.result.current.activeDashboardId).toBe('template-basic-1');
    await act(async () => hook.result.current.handleStartEdit());
    expect(hook.result.current.dashboards).toHaveLength(2);
    changeTitle(hook, '輸入後の編集');
    await act(async () => hook.result.current.handleSave());
    hook.unmount();
    const reloaded = await mount();
    expect(reloaded.result.current.widgets[0].title).toBe('輸入後の編集');
    expect(
      reloaded.result.current.widgets.filter((w) => w.metric === 'count'),
    ).toHaveLength(20);
  });

  it('does not announce failed import as successful and rejects external import while editing', async () => {
    const hook = await mount();
    mocks.readImport.mockResolvedValue(
      buildAnalysisDashboardExportContent({
        id: 'imported',
        name: '合成輸入',
        widgets: [],
      }),
    );
    mocks.save.mockResolvedValueOnce(false);
    await act(async () => hook.result.current.handleImportDashboard());
    expect(hook.result.current.activeDashboardId).toBe('template-basic');
    expect(mocks.notification.success).not.toHaveBeenCalled();
    await act(async () => hook.result.current.handleStartEdit());
    changeTitle(hook, '保持する編集');
    const writes = mocks.save.mock.calls.length;
    await act(async () => {
      mocks.externalOpen.mock.calls.at(-1)?.[0]('fixtures/synthetic.stad');
    });
    expect(hook.result.current.widgets[0].title).toBe('保持する編集');
    expect(mocks.save).toHaveBeenCalledTimes(writes);
    expect(mocks.notification.warning).toHaveBeenLastCalledWith(
      '編集を保存またはキャンセルしてからインポートしてください。',
    );
  });
  it('rejects an import that finishes reading after editing begins', async () => {
    const hook = await mount();
    await act(async () => hook.result.current.handleDuplicateDashboard());
    let finishRead: ((content: string) => void) | undefined;
    const reading = new Promise<string>((resolve) => {
      finishRead = resolve;
    });
    mocks.readImport.mockReturnValueOnce(reading);
    let importing: Promise<void> | undefined;
    await act(async () => {
      importing = hook.result.current.handleImportDashboard();
    });
    expect(mocks.readImport).toHaveBeenCalledOnce();
    await act(async () => hook.result.current.handleStartEdit());
    changeTitle(hook, '読込中に始めた編集');
    const writes = mocks.save.mock.calls.length;
    await act(async () => {
      finishRead?.(
        buildAnalysisDashboardExportContent({
          id: 'late-import',
          name: '合成輸入',
          widgets: [],
        }),
      );
      await importing;
    });
    expect(mocks.save).toHaveBeenCalledTimes(writes);
    expect(hook.result.current.widgets[0].title).toBe('読込中に始めた編集');
    expect(hook.result.current.dashboards).toHaveLength(2);
  });

  it('adds a delayed import to the latest dashboard list after an ordinary duplicate completes', async () => {
    const hook = await mount();
    let finishRead: ((content: string) => void) | undefined;
    const reading = new Promise<string>((resolve) => {
      finishRead = resolve;
    });
    mocks.readImport.mockReturnValueOnce(reading);
    let importing: Promise<void> | undefined;
    await act(async () => {
      importing = hook.result.current.handleImportDashboard();
    });
    await act(async () => hook.result.current.handleDuplicateDashboard());
    const copyId = hook.result.current.activeDashboardId;
    await act(async () => {
      finishRead?.(
        buildAnalysisDashboardExportContent({
          id: 'late-import',
          name: '合成輸入',
          widgets: [],
        }),
      );
      await importing;
    });
    expect(hook.result.current.dashboards.map((d) => d.id)).toEqual([
      'template-basic',
      copyId,
      'late-import',
    ]);
    expect(hook.result.current.activeDashboardId).toBe('late-import');
    hook.unmount();
    expect((await mount()).result.current.dashboards.map((d) => d.id)).toEqual([
      'template-basic',
      copyId,
      'late-import',
    ]);
  });
});
