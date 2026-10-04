import { useCallback, useRef } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
  AppSettings,
  DashboardSeriesFilter,
} from '../../../../../../types/settings/coreTypes';
import type { useNotification } from '../../../../../../contexts/NotificationContext';
import { generateDashboardId } from './dashboardTabController.utils';
import { useDashboardImportExport } from './useDashboardImportExport';
import { useDashboardWidgetDraftActions } from './useDashboardWidgetDraftActions';
import type { DashboardTabController } from './dashboardTabController.types';
import { useDashboardPersistence } from './useDashboardPersistence';

interface UseDashboardTabActionsParams {
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  notification: ReturnType<typeof useNotification>;
  dashboards: AnalysisDashboard[];
  activeDashboardId: string;
  activeDashboard?: AnalysisDashboard;
  activeDashboardWidgets: AnalysisDashboardWidget[];
  dashboardFilters: DashboardSeriesFilter;
  onDashboardFiltersChange?: (filters: DashboardSeriesFilter) => void;
  timelineMap: Map<string, TimelineData>;
  state: {
    isEditing: boolean;
    draftWidgets: AnalysisDashboardWidget[];
    newDashboardName: string;
    pendingDashboardId: string | null;
    setDraftWidgets: React.Dispatch<
      React.SetStateAction<AnalysisDashboardWidget[]>
    >;
    setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
    setEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setEditingWidget: React.Dispatch<
      React.SetStateAction<AnalysisDashboardWidget | null>
    >;
    setLocalDashboardFilters: React.Dispatch<
      React.SetStateAction<DashboardSeriesFilter>
    >;
    setPendingDashboardId: React.Dispatch<React.SetStateAction<string | null>>;
    setDiscardDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setCreateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setNewDashboardName: React.Dispatch<React.SetStateAction<string>>;
    setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setDetail: React.Dispatch<
      React.SetStateAction<{
        title: string;
        entries: TimelineData[];
      } | null>
    >;
  };
}

type DashboardTabActions = Pick<
  DashboardTabController,
  | 'isSaving'
  | 'saveError'
  | 'compactControlSx'
  | 'updateDashboardFilters'
  | 'handleResetFilters'
  | 'handleStartEdit'
  | 'handleAddWidget'
  | 'handleCancelEdit'
  | 'handleSave'
  | 'handleDashboardChange'
  | 'handleConfirmDiscardAndSwitch'
  | 'handleCreateDashboard'
  | 'handleDuplicateDashboard'
  | 'handleRequestDeleteDashboard'
  | 'handleDeleteDashboard'
  | 'handleExportDashboard'
  | 'handleImportDashboard'
  | 'openEditor'
  | 'handleEditorSave'
  | 'handleDelete'
  | 'handleDuplicate'
  | 'handleMove'
  | 'handleChartPointSelect'
>;

export const useDashboardTabActions = ({
  settings,
  saveSettings,
  notification,
  dashboards,
  activeDashboardId,
  activeDashboard,
  activeDashboardWidgets,
  dashboardFilters,
  onDashboardFiltersChange,
  timelineMap,
  state,
}: UseDashboardTabActionsParams): DashboardTabActions => {
  const isTemplate = activeDashboard?.id === 'template-basic';
  const compactControlSx = {
    '& .MuiInputBase-input': { py: 0.75 },
    '& .MuiSelect-select': { py: 0.75 },
  };

  const { isSaving, saveError, isSavePending, saveDashboards } =
    useDashboardPersistence({ settings, saveSettings });
  const editingRef = useRef(state.isEditing);
  editingRef.current = state.isEditing;
  const isImportBlocked = useCallback(
    (): boolean => editingRef.current || isSavePending(),
    [isSavePending],
  );

  const updateDashboardFilters = useCallback(
    (patch: Partial<DashboardSeriesFilter>) => {
      const next = { ...dashboardFilters, ...patch };
      if (onDashboardFiltersChange) {
        onDashboardFiltersChange(next);
      } else {
        state.setLocalDashboardFilters(next);
      }
    },
    [dashboardFilters, onDashboardFiltersChange, state],
  );

  const openEditor = useCallback(
    (widget?: AnalysisDashboardWidget) => {
      if (isSavePending()) return;
      if (isTemplate) {
        notification.warning(
          '基本分析テンプレートは複製してから編集してください。',
        );
        return;
      }
      state.setEditingWidget(widget ?? null);
      state.setEditorOpen(true);
    },
    [isSavePending, isTemplate, notification, state],
  );

  const duplicateDashboard = useCallback(
    async (startEditing: boolean): Promise<void> => {
      if (!activeDashboard) return;
      const newDashboard: AnalysisDashboard = {
        id: generateDashboardId(),
        name: `${activeDashboard.name} (コピー)`,
        widgets: activeDashboard.widgets ?? [],
      };
      if (
        !(await saveDashboards([...dashboards, newDashboard], newDashboard.id))
      )
        return;
      state.setDraftWidgets(newDashboard.widgets);
      state.setIsEditing(startEditing);
      notification.success('ダッシュボードを複製しました。');
    },
    [activeDashboard, dashboards, notification, saveDashboards, state],
  );

  const handleDuplicateDashboard = useCallback(
    (): Promise<void> => duplicateDashboard(false),
    [duplicateDashboard],
  );

  const handleStartEdit = useCallback(async (): Promise<void> => {
    if (isSavePending()) return;
    if (isTemplate) {
      await duplicateDashboard(true);
      return;
    }
    state.setDraftWidgets(activeDashboardWidgets);
    state.setIsEditing(true);
  }, [
    activeDashboardWidgets,
    duplicateDashboard,
    isSavePending,
    isTemplate,
    state,
  ]);

  const handleAddWidget = useCallback(() => {
    if (isSavePending()) return;
    if (isTemplate) {
      notification.warning(
        '基本分析テンプレートは複製してから編集してください。',
      );
      return;
    }
    if (!state.isEditing) {
      state.setDraftWidgets(activeDashboardWidgets);
      state.setIsEditing(true);
    }
    openEditor();
  }, [
    activeDashboardWidgets,
    isSavePending,
    isTemplate,
    notification,
    openEditor,
    state,
  ]);

  const handleCancelEdit = useCallback(() => {
    if (isSavePending()) return;
    state.setDraftWidgets(activeDashboardWidgets);
    state.setIsEditing(false);
  }, [activeDashboardWidgets, isSavePending, state]);

  const handleSave = useCallback(async () => {
    if (isTemplate) {
      notification.warning(
        '基本分析テンプレートは複製してから編集してください。',
      );
      return;
    }
    const nextDashboards = dashboards.map((item) =>
      item.id === activeDashboardId
        ? { ...item, widgets: state.draftWidgets }
        : item,
    );
    if (!(await saveDashboards(nextDashboards, activeDashboardId))) return;
    state.setIsEditing(false);
    notification.success('ダッシュボードを保存しました。');
  }, [
    activeDashboardId,
    dashboards,
    isTemplate,
    notification,
    saveDashboards,
    state,
  ]);

  const handleDashboardChange = useCallback(
    async (nextId: string) => {
      if (!nextId || nextId === activeDashboardId) return;
      if (state.isEditing) {
        state.setPendingDashboardId(nextId);
        state.setDiscardDialogOpen(true);
        return;
      }
      if (!(await saveDashboards(dashboards, nextId))) return;
      state.setIsEditing(false);
    },
    [activeDashboardId, dashboards, saveDashboards, state],
  );

  const handleConfirmDiscardAndSwitch = useCallback(async () => {
    if (!state.pendingDashboardId) {
      state.setDiscardDialogOpen(false);
      return;
    }
    const nextId = state.pendingDashboardId;
    if (!(await saveDashboards(dashboards, nextId))) return;
    state.setPendingDashboardId(null);
    state.setDiscardDialogOpen(false);
    state.setIsEditing(false);
  }, [dashboards, saveDashboards, state]);

  const handleCreateDashboard = useCallback(async () => {
    const name = state.newDashboardName.trim();
    if (!name) {
      notification.warning('ダッシュボード名を入力してください。');
      return;
    }
    if (
      dashboards.some(
        (dashboard) =>
          dashboard.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      notification.warning('同名のダッシュボードが既に存在します。');
      return;
    }
    const newDashboard: AnalysisDashboard = {
      id: generateDashboardId(),
      name,
      widgets: [],
    };
    if (!(await saveDashboards([...dashboards, newDashboard], newDashboard.id)))
      return;
    state.setDraftWidgets([]);
    state.setIsEditing(true);
    state.setCreateDialogOpen(false);
    state.setNewDashboardName('新規ダッシュボード');
  }, [dashboards, notification, saveDashboards, state]);

  const handleRequestDeleteDashboard = useCallback(() => {
    if (!activeDashboard) return;
    const protectedIds = new Set(['default', 'template-basic']);
    if (protectedIds.has(activeDashboard.id)) {
      notification.warning('このダッシュボードは削除できません。');
      return;
    }
    if (dashboards.length <= 1) {
      notification.warning('ダッシュボードは最低1つ必要です。');
      return;
    }
    state.setDeleteDialogOpen(true);
  }, [activeDashboard, dashboards.length, notification, state]);

  const handleDeleteDashboard = useCallback(async () => {
    if (!activeDashboard) return;
    const nextDashboards = dashboards.filter(
      (item) => item.id !== activeDashboard.id,
    );
    const nextActiveId = nextDashboards[0]?.id ?? '';
    if (!(await saveDashboards(nextDashboards, nextActiveId))) return;
    state.setDeleteDialogOpen(false);
    state.setIsEditing(false);
  }, [activeDashboard, dashboards, saveDashboards, state]);

  const { handleExportDashboard, handleImportDashboard } =
    useDashboardImportExport({
      activeDashboard,
      dashboards,
      notification,
      saveDashboards,
      isImportBlocked,
    });

  const { handleEditorSave, handleDelete, handleDuplicate, handleMove } =
    useDashboardWidgetDraftActions({
      setDraftWidgets: state.setDraftWidgets,
      setEditorOpen: state.setEditorOpen,
    });

  const handleResetFilters = useCallback(() => {
    if (onDashboardFiltersChange) {
      onDashboardFiltersChange({});
    } else {
      state.setLocalDashboardFilters({});
    }
  }, [onDashboardFiltersChange, state]);

  const handleChartPointSelect = useCallback(
    (
      widgetTitle: string,
      payload: {
        title: string;
        entryIds: string[];
      },
    ) => {
      if (!payload.entryIds || payload.entryIds.length === 0) return;
      const uniqueEntryIds = Array.from(new Set(payload.entryIds));
      const entries = uniqueEntryIds
        .map((id) => timelineMap.get(id))
        .filter((item): item is TimelineData => Boolean(item));
      state.setDetail({
        title: `Dashboard > ${widgetTitle} > ${payload.title}`,
        entries,
      });
    },
    [timelineMap, state],
  );

  return {
    isSaving,
    saveError,
    compactControlSx,
    updateDashboardFilters,
    handleResetFilters,
    handleStartEdit,
    handleAddWidget,
    handleCancelEdit,
    handleSave,
    handleDashboardChange,
    handleConfirmDiscardAndSwitch,
    handleCreateDashboard,
    handleDuplicateDashboard,
    handleRequestDeleteDashboard,
    handleDeleteDashboard,
    handleExportDashboard,
    handleImportDashboard,
    openEditor,
    handleEditorSave,
    handleDelete,
    handleDuplicate,
    handleMove,
    handleChartPointSelect,
  };
};
