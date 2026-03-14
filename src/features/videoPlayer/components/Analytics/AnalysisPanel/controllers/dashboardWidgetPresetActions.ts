import { useCallback } from 'react';
import type React from 'react';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type {
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import {
  generateWidgetId,
  resolveDefaultGroup,
} from './dashboardWidgetDialogState.utils';

interface UseDashboardWidgetPresetActionsParams {
  availableGroups: string[];
  title: string;
  quickAction: string;
  quickLabelGroup: string;
  seriesCount: number;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setAnalysisMode: React.Dispatch<React.SetStateAction<DashboardAnalysisMode>>;
  setDataMode: React.Dispatch<React.SetStateAction<'axis' | 'series'>>;
  setChartType: React.Dispatch<React.SetStateAction<DashboardChartType>>;
  setMetric: React.Dispatch<React.SetStateAction<DashboardMetric>>;
  setCalcMode: React.Dispatch<React.SetStateAction<DashboardCalcMode>>;
  setSeriesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setPrimaryAxis: React.Dispatch<React.SetStateAction<MatrixAxisConfig>>;
  setWidgetFilters: React.Dispatch<React.SetStateAction<DashboardSeriesFilter>>;
  setSeries: React.Dispatch<React.SetStateAction<DashboardSeriesDefinition[]>>;
}

export const useDashboardWidgetPresetActions = ({
  availableGroups,
  title,
  quickAction,
  quickLabelGroup,
  seriesCount,
  setTitle,
  setAnalysisMode,
  setDataMode,
  setChartType,
  setMetric,
  setCalcMode,
  setSeriesEnabled,
  setPrimaryAxis,
  setWidgetFilters,
  setSeries,
}: UseDashboardWidgetPresetActionsParams) => {
  const applyPreset = useCallback(
    (mode: 'labelPie' | 'compareBar' | 'seriesPie') => {
      setAnalysisMode('standard');
      if (mode === 'labelPie') {
        setDataMode('axis');
        setChartType('pie');
        setMetric('count');
        setCalcMode('percentTotal');
        setSeriesEnabled(false);
        setPrimaryAxis({
          type: 'group',
          value: resolveDefaultGroup(availableGroups, 'actionResult'),
        });
        if (!title.trim()) setTitle('ラベル比率');
        return;
      }
      if (mode === 'compareBar') {
        setDataMode('axis');
        setChartType('bar');
        setMetric('count');
        setCalcMode('raw');
        setSeriesEnabled(false);
        setPrimaryAxis({
          type: 'group',
          value: resolveDefaultGroup(availableGroups, 'actionType'),
        });
        if (!title.trim()) setTitle('件数比較');
        return;
      }
      setDataMode('series');
      setChartType('pie');
      setMetric('count');
      setCalcMode('percentTotal');
      if (seriesCount === 0) {
        setSeries([
          { id: generateWidgetId(), name: 'シリーズ1', filters: {} },
          { id: generateWidgetId(), name: 'シリーズ2', filters: {} },
        ]);
      }
      if (!title.trim()) setTitle('シリーズ比較');
    },
    [
      availableGroups,
      seriesCount,
      setAnalysisMode,
      setCalcMode,
      setChartType,
      setDataMode,
      setMetric,
      setPrimaryAxis,
      setSeries,
      setSeriesEnabled,
      setTitle,
      title,
    ],
  );

  const handleQuickPieApply = useCallback(() => {
    const labelGroup = quickLabelGroup || availableGroups[0] || 'all_labels';
    setAnalysisMode('standard');
    setDataMode('axis');
    setChartType('pie');
    setMetric('count');
    setCalcMode('percentTotal');
    setSeriesEnabled(false);
    setPrimaryAxis({ type: 'group', value: labelGroup });
    setWidgetFilters({
      action: quickAction || undefined,
      labelGroup: labelGroup || undefined,
      labelValue: undefined,
    });
    if (!title.trim()) {
      const parts = [quickAction, labelGroup].filter(Boolean);
      setTitle(parts.length ? `${parts.join(' ')} 比率` : 'ラベル比率');
    }
  }, [
    availableGroups,
    quickAction,
    quickLabelGroup,
    setAnalysisMode,
    setCalcMode,
    setChartType,
    setDataMode,
    setMetric,
    setPrimaryAxis,
    setSeriesEnabled,
    setTitle,
    setWidgetFilters,
    title,
  ]);

  return {
    applyPreset,
    handleQuickPieApply,
  };
};
