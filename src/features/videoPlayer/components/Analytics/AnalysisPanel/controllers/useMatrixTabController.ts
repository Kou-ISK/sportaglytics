import { useCallback, useMemo, useState } from 'react';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { MatrixAxisConfig } from '../../../../../../types/analysis/matrix';
import type { PlaylistItem } from '../../../../../../types/playlist/core';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  extractUniqueGroups,
  getLabelsFromTimelineData,
} from '../../../../../../utils/labelExtractors';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import { useMatrixFilters } from './useMatrixFilters';
import { useMatrixAxes } from './useMatrixAxes';
import {
  deriveMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from './matrixFilterUtils';
import { useMatrixTableExport } from './useMatrixTableExport';
import { buildMatrixFilterChips } from '../utils/matrixFilterChips';
import type { MatrixTabViewProps } from '../components/MatrixTabView';

export interface MatrixTabControllerParams {
  hasData: boolean;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  emptyMessage: string;
  totalTimelineCount?: number;
  matrixAxes?: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  };
  onMatrixAxesChange?: (axes: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  }) => void;
  matrixFilters?: MatrixFilterState;
  onMatrixFiltersChange?: (filters: MatrixFilterState) => void;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
}

const createPlaylistItemId = (index: number): string => {
  return globalThis.crypto?.randomUUID?.() ?? `matrix-${Date.now()}-${index}`;
};

const buildMatrixPlaylistItems = (entries: TimelineData[]): PlaylistItem[] => {
  const addedAt = Date.now();
  return entries.map((entry, index) => ({
    id: createPlaylistItemId(index),
    timelineItemId: entry.id,
    actionName: entry.actionName,
    startTime: entry.startTime,
    endTime: entry.endTime,
    labels: entry.labels,
    memo: entry.memo,
    addedAt,
  }));
};

export const useMatrixTabController = ({
  hasData,
  timeline,
  onJumpToSegment,
  emptyMessage,
  totalTimelineCount,
  matrixAxes,
  onMatrixAxesChange,
  matrixFilters,
  onMatrixFiltersChange,
  onCreateAiPlaylist,
}: MatrixTabControllerParams): MatrixTabViewProps => {
  const notification = useNotification();
  const [detail, setDetail] = useState<{
    title: string;
    entries: TimelineData[];
  } | null>(null);

  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );

  const {
    customRowAxis: localRowAxis,
    customColumnAxis: localColumnAxis,
    setCustomRowAxis: setLocalRowAxis,
    setCustomColumnAxis: setLocalColumnAxis,
  } = useMatrixAxes(availableGroups);

  const {
    filters: localFilters,
    setFilterTeam: setLocalFilterTeam,
    setFilterAction: setLocalFilterAction,
    applyFilters: applyLocalFilters,
    clearLabelFilters: clearLocalLabelFilters,
  } = useMatrixFilters(timeline);

  const customRowAxis = matrixAxes?.row ?? localRowAxis;
  const customColumnAxis = matrixAxes?.column ?? localColumnAxis;
  const filters = matrixFilters ?? localFilters;
  const {
    availableTeams,
    availableActions,
    availableLabelValues,
    filteredTimeline,
    hasActiveFilters,
  } = useMemo(
    () => deriveMatrixFilters(timeline, filters),
    [timeline, filters],
  );
  const availableActionsByTeam = useMemo(() => {
    const actionsByTeam: Record<string, Set<string>> = {};
    timeline.forEach((item) => {
      const team = extractTeamFromActionName(item.actionName);
      const action = extractActionFromActionName(item.actionName);
      if (!team || !action) return;
      actionsByTeam[team] ??= new Set<string>();
      actionsByTeam[team].add(action);
    });
    return Object.fromEntries(
      Object.entries(actionsByTeam).map(([team, actions]) => [
        team,
        Array.from(actions).sort((a, b) => a.localeCompare(b)),
      ]),
    );
  }, [timeline]);
  const availableLabelValuesByGroup = useMemo(() => {
    const valuesByGroup: Record<string, Set<string>> = {};
    timeline.forEach((item) => {
      getLabelsFromTimelineData(item).forEach((label) => {
        if (!label.group || !label.name) return;
        valuesByGroup[label.group] ??= new Set<string>();
        valuesByGroup[label.group].add(label.name);
      });
    });
    return Object.fromEntries(
      Object.entries(valuesByGroup).map(([group, values]) => [
        group,
        Array.from(values).sort((a, b) => a.localeCompare(b)),
      ]),
    );
  }, [timeline]);

  const setCustomRowAxis = (next: MatrixAxisConfig): void => {
    if (onMatrixAxesChange) {
      onMatrixAxesChange({ row: next, column: customColumnAxis });
      return;
    }

    setLocalRowAxis(next);
  };

  const setCustomColumnAxis = (next: MatrixAxisConfig): void => {
    if (onMatrixAxesChange) {
      onMatrixAxesChange({ row: customRowAxis, column: next });
      return;
    }

    setLocalColumnAxis(next);
  };

  const setFilterTeam = (value: string): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, team: value });
      return;
    }

    setLocalFilterTeam(value);
  };

  const setFilterAction = (value: string): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({ ...filters, action: value });
      return;
    }

    setLocalFilterAction(value);
  };

  const clearLabelFilters = (): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange({
        ...filters,
        labelGroup: MATRIX_FILTER_ALL,
        labelValue: MATRIX_FILTER_ALL,
      });
      return;
    }

    clearLocalLabelFilters();
  };

  const applyFilters = (nextFilters: MatrixFilterState): void => {
    if (onMatrixFiltersChange) {
      onMatrixFiltersChange(nextFilters);
      return;
    }

    applyLocalFilters(nextFilters);
  };

  const customMatrix = useMemo(() => {
    return buildHierarchicalMatrix(
      filteredTimeline,
      customRowAxis,
      customColumnAxis,
    );
  }, [filteredTimeline, customRowAxis, customColumnAxis]);

  const { exportMatrix } = useMatrixTableExport({
    customMatrix,
    customRowAxis,
    customColumnAxis,
    notification,
  });

  const allFilterValue = MATRIX_FILTER_ALL;
  const filterChips = buildMatrixFilterChips({
    filters,
    onResetTeam: () => setFilterTeam(allFilterValue),
    onResetAction: () => setFilterAction(allFilterValue),
    onResetLabels: clearLabelFilters,
  });

  const filterCount = Object.values(filters).filter(
    (value) => value !== '' && value !== allFilterValue,
  ).length;

  const handleCreateDetailPlaylist = useCallback(
    async (title: string, entries: TimelineData[]): Promise<void> => {
      if (!onCreateAiPlaylist) {
        notification.warning('プレイリスト機能が利用できません。');
        return;
      }
      if (entries.length === 0) {
        notification.info('プレイリストに追加できる映像がありません。');
        return;
      }

      try {
        await onCreateAiPlaylist({
          name: `クロス集計: ${title}`,
          items: buildMatrixPlaylistItems(entries),
        });
        notification.success('プレイリストを作成しました。');
      } catch (error) {
        console.debug('[Matrix] playlist creation failed', error);
        notification.error('プレイリストの作成に失敗しました。');
      }
    },
    [notification, onCreateAiPlaylist],
  );

  return {
    hasData,
    emptyMessage,
    totalTimelineCount,
    filteredTimelineCount: filteredTimeline.length,
    timelineCount: timeline.length,
    availableGroups,
    availableTeams,
    availableActions,
    availableLabelValues,
    availableActionsByTeam,
    availableLabelValuesByGroup,
    customRowAxis,
    customColumnAxis,
    filters,
    hasActiveFilters,
    filterCount,
    filterChips,
    customMatrix,
    detail,
    onRowAxisChange: setCustomRowAxis,
    onColumnAxisChange: setCustomColumnAxis,
    onFiltersApply: applyFilters,
    onExportMatrix: exportMatrix,
    onCreateDetailPlaylist: handleCreateDetailPlaylist,
    onDrilldown: (title, entries) => {
      setDetail({ title, entries });
    },
    onDetailClose: () => {
      setDetail(null);
    },
    onJumpToSegment,
  };
};
