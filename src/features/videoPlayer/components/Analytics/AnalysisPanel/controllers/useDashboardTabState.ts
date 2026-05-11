import { useState } from 'react';
import type {
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../types/settings/coreTypes';
import type { DashboardDetail } from './dashboardTabController.types';

export const useDashboardTabState = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<AnalysisDashboardWidget[]>(
    [],
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] =
    useState<AnalysisDashboardWidget | null>(null);
  const [localDashboardFilters, setLocalDashboardFilters] =
    useState<DashboardSeriesFilter>({});
  const [dashboardMenuAnchor, setDashboardMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] =
    useState('新規ダッシュボード');
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingDashboardId, setPendingDashboardId] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detail, setDetail] = useState<DashboardDetail | null>(null);

  return {
    isEditing,
    setIsEditing,
    draftWidgets,
    setDraftWidgets,
    editorOpen,
    setEditorOpen,
    editingWidget,
    setEditingWidget,
    localDashboardFilters,
    setLocalDashboardFilters,
    dashboardMenuAnchor,
    setDashboardMenuAnchor,
    createDialogOpen,
    setCreateDialogOpen,
    newDashboardName,
    setNewDashboardName,
    discardDialogOpen,
    setDiscardDialogOpen,
    pendingDashboardId,
    setPendingDashboardId,
    deleteDialogOpen,
    setDeleteDialogOpen,
    detail,
    setDetail,
  };
};
