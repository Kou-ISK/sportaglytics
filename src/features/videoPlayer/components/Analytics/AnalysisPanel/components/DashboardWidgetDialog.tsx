import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Stack,
} from '@mui/material';
import type { AnalysisDashboardWidget } from '../../../../../../types/settings/coreTypes';
import {
  DEFAULT_WIDGET_FILTERS,
  useDashboardWidgetDialogState,
} from '../controllers/useDashboardWidgetDialogState';
import { DashboardWidgetAxisSection } from './dashboardWidgetDialog/DashboardWidgetAxisSection';
import { DashboardWidgetBasicSection } from './dashboardWidgetDialog/DashboardWidgetBasicSection';
import { DashboardWidgetCurrentSettings } from './dashboardWidgetDialog/DashboardWidgetCurrentSettings';
import { DashboardWidgetFilterSection } from './dashboardWidgetDialog/DashboardWidgetFilterSection';
import { DashboardWidgetPresetSection } from './dashboardWidgetDialog/DashboardWidgetPresetSection';
import { DashboardWidgetQuickAdvancedSection } from './dashboardWidgetDialog/DashboardWidgetQuickAdvancedSection';
import { DashboardWidgetVisualizationSection } from './dashboardWidgetDialog/DashboardWidgetVisualizationSection';

interface DashboardWidgetDialogProps {
  open: boolean;
  availableGroups: string[];
  availableActions: string[];
  availableLabelValues: Record<string, string[]>;
  initial?: AnalysisDashboardWidget | null;
  onSave: (widget: AnalysisDashboardWidget) => void;
  onClose: () => void;
}

export const DashboardWidgetDialog = ({
  open,
  availableGroups,
  availableActions,
  availableLabelValues,
  initial,
  onSave,
  onClose,
}: DashboardWidgetDialogProps) => {
  const {
    title,
    chartType,
    metric,
    analysisMode,
    primaryAxis,
    resolvedSeriesEnabled,
    seriesAxis,
    colSpan,
    limit,
    dataMode,
    series,
    calcMode,
    widgetFilters,
    quickAction,
    quickLabelGroup,
    showTemplates,
    showFilters,
    showAdvanced,
    timeBucketSec,
    histogramBinSec,
    rollingWindow,
    outlierIqrMultiplier,
    filterSummary,
    setTitle,
    setChartType,
    setMetric,
    setAnalysisMode,
    setPrimaryAxis,
    setSeriesEnabled,
    setSeriesAxis,
    setColSpan,
    setLimit,
    setDataMode,
    setCalcMode,
    setWidgetFilters,
    setQuickAction,
    setQuickLabelGroup,
    setShowTemplates,
    setShowFilters,
    setShowAdvanced,
    setTimeBucketSec,
    setHistogramBinSec,
    setRollingWindow,
    setOutlierIqrMultiplier,
    applyPreset,
    handleSave,
    handleSeriesChange,
    handleSeriesFilterChange,
    addSeries,
    removeSeries,
    updateWidgetFilters,
    handleQuickPieApply,
    getAxisLabel,
    getChartLabel,
    getAnalysisModeLabel,
  } = useDashboardWidgetDialogState({
    open,
    availableGroups,
    availableActions,
    availableLabelValues,
    initial,
    onSave,
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initial ? 'ウィジェットを編集' : 'ウィジェットを追加'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <DashboardWidgetCurrentSettings
            dataMode={dataMode}
            analysisMode={analysisMode}
            primaryAxis={primaryAxis}
            chartType={chartType}
            metric={metric}
            filterSummary={filterSummary}
            getAnalysisModeLabel={getAnalysisModeLabel}
            getAxisLabel={getAxisLabel}
            getChartLabel={getChartLabel}
          />

          <DashboardWidgetPresetSection onApplyPreset={applyPreset} />

          <DashboardWidgetBasicSection
            title={title}
            setTitle={setTitle}
            dataMode={dataMode}
            setDataMode={setDataMode}
            analysisMode={analysisMode}
          />

          <DashboardWidgetAxisSection
            analysisMode={analysisMode}
            dataMode={dataMode}
            primaryAxis={primaryAxis}
            setPrimaryAxis={setPrimaryAxis}
            availableGroups={availableGroups}
            resolvedSeriesEnabled={resolvedSeriesEnabled}
            setSeriesEnabled={setSeriesEnabled}
            chartType={chartType}
            seriesAxis={seriesAxis}
            setSeriesAxis={setSeriesAxis}
            calcMode={calcMode}
            setCalcMode={setCalcMode}
            addSeries={addSeries}
            series={series}
            handleSeriesChange={handleSeriesChange}
            removeSeries={removeSeries}
            handleSeriesFilterChange={handleSeriesFilterChange}
            availableActions={availableActions}
            availableLabelValues={availableLabelValues}
            timeBucketSec={timeBucketSec}
            setTimeBucketSec={setTimeBucketSec}
            rollingWindow={rollingWindow}
            setRollingWindow={setRollingWindow}
            histogramBinSec={histogramBinSec}
            setHistogramBinSec={setHistogramBinSec}
            outlierIqrMultiplier={outlierIqrMultiplier}
            setOutlierIqrMultiplier={setOutlierIqrMultiplier}
          />

          <DashboardWidgetVisualizationSection
            analysisMode={analysisMode}
            setAnalysisMode={setAnalysisMode}
            chartType={chartType}
            setChartType={setChartType}
            metric={metric}
            setMetric={setMetric}
          />

          <DashboardWidgetFilterSection
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            onResetFilters={() => setWidgetFilters(DEFAULT_WIDGET_FILTERS)}
            widgetFilters={widgetFilters}
            updateWidgetFilters={updateWidgetFilters}
            availableActions={availableActions}
            availableGroups={availableGroups}
            availableLabelValues={availableLabelValues}
          />

          <DashboardWidgetQuickAdvancedSection
            showTemplates={showTemplates}
            setShowTemplates={setShowTemplates}
            quickAction={quickAction}
            setQuickAction={setQuickAction}
            availableActions={availableActions}
            quickLabelGroup={quickLabelGroup}
            setQuickLabelGroup={setQuickLabelGroup}
            availableGroups={availableGroups}
            handleQuickPieApply={handleQuickPieApply}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            colSpan={colSpan}
            setColSpan={setColSpan}
            limit={limit}
            setLimit={setLimit}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
