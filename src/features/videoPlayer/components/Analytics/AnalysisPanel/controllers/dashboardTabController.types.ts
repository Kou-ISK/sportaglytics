import type { TimelineData } from '../../../../../../types/TimelineData';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';

export interface UseDashboardTabControllerParams {
  timeline: TimelineData[];
  teamNames: string[];
  dashboardFilters?: DashboardSeriesFilter;
  onDashboardFiltersChange?: (filters: DashboardSeriesFilter) => void;
}

export interface DashboardDetail {
  title: string;
  entries: TimelineData[];
}

export interface DashboardTabController {
  availableGroups: string[];
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: Record<string, string[]>;
  orderedTeams: string[];
  teamRoleMap: { team1?: string; team2?: string };
  teamContext: { team1Name: string; team2Name: string };
  compactControlSx: {
    '& .MuiInputBase-input': { py: number };
    '& .MuiSelect-select': { py: number };
  };
  isEditing: boolean;
  draftWidgets: AnalysisDashboardWidget[];
  editorOpen: boolean;
  editingWidget: AnalysisDashboardWidget | null;
  dashboardFilters: DashboardSeriesFilter;
  dashboardMenuAnchor: HTMLElement | null;
  createDialogOpen: boolean;
  newDashboardName: string;
  discardDialogOpen: boolean;
  pendingDashboardId: string | null;
  deleteDialogOpen: boolean;
  detail: DashboardDetail | null;
  dashboards: AnalysisDashboard[];
  activeDashboardId: string;
  activeDashboard?: AnalysisDashboard;
  activeDashboardWidgets: AnalysisDashboardWidget[];
  widgets: AnalysisDashboardWidget[];
  appliedFilterChips: string[];
  timelineMap: Map<string, TimelineData>;
  updateDashboardFilters: (patch: Partial<DashboardSeriesFilter>) => void;
  handleResetFilters: () => void;
  handleStartEdit: () => void;
  handleAddWidget: () => void;
  handleCancelEdit: () => void;
  handleSave: () => Promise<void>;
  handleDashboardChange: (nextId: string) => Promise<void>;
  handleConfirmDiscardAndSwitch: () => Promise<void>;
  handleCreateDashboard: () => Promise<void>;
  handleDuplicateDashboard: () => Promise<void>;
  handleRequestDeleteDashboard: () => void;
  handleDeleteDashboard: () => Promise<void>;
  handleExportDashboard: () => Promise<void>;
  handleImportDashboard: () => Promise<void>;
  openEditor: (widget?: AnalysisDashboardWidget) => void;
  handleEditorSave: (widget: AnalysisDashboardWidget) => void;
  handleDelete: (id: string) => void;
  handleDuplicate: (widget: AnalysisDashboardWidget) => void;
  handleMove: (id: string, direction: 'up' | 'down') => void;
  handleChartPointSelect: (
    widgetTitle: string,
    payload: { title: string; entryIds: string[] },
  ) => void;
  setEditorOpen: (open: boolean) => void;
  setDashboardMenuAnchor: (anchor: HTMLElement | null) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setNewDashboardName: (name: string) => void;
  setDiscardDialogOpen: (open: boolean) => void;
  setPendingDashboardId: (id: string | null) => void;
  setDeleteDialogOpen: (open: boolean) => void;
  setDetail: (detail: DashboardDetail | null) => void;
}
