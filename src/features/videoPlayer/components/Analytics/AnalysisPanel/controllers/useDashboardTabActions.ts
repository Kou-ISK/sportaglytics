import { useCallback } from 'react';
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
}: UseDashboardTabActionsParams) => {
  const compactControlSx = {
    '& .MuiInputBase-input': { py: 0.75 },
    '& .MuiSelect-select': { py: 0.75 },
  };

  const saveDashboards = useCallback(
    async (nextDashboards: AnalysisDashboard[], nextActiveId: string) => {
      await saveSettings({
        ...settings,
        analysisDashboard: {
          dashboards: nextDashboards,
          activeDashboardId: nextActiveId,
        },
      });
    },
    [saveSettings, settings],
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
      state.setEditingWidget(widget ?? null);
      state.setEditorOpen(true);
    },
    [state],
  );

  const handleStartEdit = useCallback(() => {
    state.setDraftWidgets(activeDashboardWidgets);
    state.setIsEditing(true);
  }, [activeDashboardWidgets, state]);

  const handleAddWidget = useCallback(() => {
    if (!state.isEditing) {
      state.setDraftWidgets(activeDashboardWidgets);
      state.setIsEditing(true);
    }
    openEditor();
  }, [activeDashboardWidgets, openEditor, state]);

  const handleCancelEdit = useCallback(() => {
    state.setDraftWidgets(activeDashboardWidgets);
    state.setIsEditing(false);
  }, [activeDashboardWidgets, state]);

  const handleSave = useCallback(async () => {
    const nextDashboards = dashboards.map((item) =>
      item.id === activeDashboardId
        ? { ...item, widgets: state.draftWidgets }
        : item,
    );
    await saveDashboards(nextDashboards, activeDashboardId);
    state.setIsEditing(false);
  }, [activeDashboardId, dashboards, saveDashboards, state]);

  const handleDashboardChange = useCallback(
    async (nextId: string) => {
      if (!nextId || nextId === activeDashboardId) return;
      if (state.isEditing) {
        state.setPendingDashboardId(nextId);
        state.setDiscardDialogOpen(true);
        return;
      }
      state.setIsEditing(false);
      await saveDashboards(dashboards, nextId);
    },
    [activeDashboardId, dashboards, saveDashboards, state],
  );

  const handleConfirmDiscardAndSwitch = useCallback(async () => {
    if (!state.pendingDashboardId) {
      state.setDiscardDialogOpen(false);
      return;
    }
    const nextId = state.pendingDashboardId;
    state.setPendingDashboardId(null);
    state.setDiscardDialogOpen(false);
    state.setIsEditing(false);
    await saveDashboards(dashboards, nextId);
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
    await saveDashboards([...dashboards, newDashboard], newDashboard.id);
    state.setDraftWidgets([]);
    state.setIsEditing(true);
    state.setCreateDialogOpen(false);
    state.setNewDashboardName('新規ダッシュボード');
  }, [dashboards, notification, saveDashboards, state]);

  const handleDuplicateDashboard = useCallback(async () => {
    if (!activeDashboard) return;
    const newDashboard: AnalysisDashboard = {
      id: generateDashboardId(),
      name: `${activeDashboard.name} (コピー)`,
      widgets: activeDashboard.widgets ?? [],
    };
    await saveDashboards([...dashboards, newDashboard], newDashboard.id);
    state.setDraftWidgets(newDashboard.widgets);
    state.setIsEditing(false);
  }, [activeDashboard, dashboards, saveDashboards, state]);

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
    state.setDeleteDialogOpen(false);
    state.setIsEditing(false);
    await saveDashboards(nextDashboards, nextActiveId);
  }, [activeDashboard, dashboards, saveDashboards, state]);

  const { handleExportDashboard, handleImportDashboard } =
    useDashboardImportExport({
      activeDashboard,
      dashboards,
      notification,
      saveDashboards,
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
