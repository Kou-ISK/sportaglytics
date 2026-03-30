import React from 'react';
import { Stack } from '@mui/material';
import type { AIAnalysisTabViewProps } from './AIAnalysisTabView.types';
import { AIAnalysisInsightsSidebar } from './ai/AIAnalysisInsightsSidebar';
import { AIAnalysisSettingsAccordion } from './ai/AIAnalysisSettingsAccordion';
import {
  formatBytes,
  formatDurationShort,
  formatGapShort,
  formatPercent,
  formatSeconds,
} from './ai/aiAnalysisFormatters';
import { EVIDENCE_DEFAULT_VISIBLE_COUNT } from '../controllers/useAIAnalysisTabController';

export const AIAnalysisSidebarColumn = (
  props: AIAnalysisTabViewProps,
): React.JSX.Element => {
  const {
    onJumpToSegment,
    accordionSx,
    isEvidenceAccordionOpen,
    setIsEvidenceAccordionOpen,
    groundedEvidence,
    visibleEvidenceItems,
    showAllEvidence,
    setShowAllEvidence,
    hiddenEvidenceCount,
    isInsightAccordionOpen,
    setIsInsightAccordionOpen,
    insightDimension,
    setInsightDimension,
    insightDimensionOptions,
    resolvedInsightLabel,
    insightData,
    timelineMap,
    isSettingsAccordionOpen,
    setIsSettingsAccordionOpen,
    modelSummary,
    showAiSettings,
    setShowAiSettings,
    aiSettings,
    setAiSettings,
    modelsStatus,
    availableModels,
    isAutoModel,
    recommendedModel,
    modelsError,
    availableGroups,
    handleSaveSettings,
    settingsMessage,
  } = props;

  return (
    <Stack spacing={2}>
      <AIAnalysisInsightsSidebar
        accordionSx={accordionSx}
        isEvidenceAccordionOpen={isEvidenceAccordionOpen}
        onEvidenceAccordionChange={setIsEvidenceAccordionOpen}
        groundedEvidence={groundedEvidence}
        visibleEvidenceItems={visibleEvidenceItems}
        showAllEvidence={showAllEvidence}
        hiddenEvidenceCount={hiddenEvidenceCount}
        evidenceDefaultVisibleCount={EVIDENCE_DEFAULT_VISIBLE_COUNT}
        onToggleShowAllEvidence={() => setShowAllEvidence((prev) => !prev)}
        onJumpToSegment={onJumpToSegment}
        isInsightAccordionOpen={isInsightAccordionOpen}
        onInsightAccordionChange={setIsInsightAccordionOpen}
        insightDimension={insightDimension}
        onInsightDimensionChange={setInsightDimension}
        insightDimensionOptions={insightDimensionOptions}
        resolvedInsightLabel={resolvedInsightLabel}
        insightData={insightData}
        timelineMap={timelineMap}
        formatSeconds={formatSeconds}
        formatPercent={formatPercent}
        formatDurationShort={formatDurationShort}
        formatGapShort={formatGapShort}
      />

      <AIAnalysisSettingsAccordion
        accordionSx={accordionSx}
        isSettingsAccordionOpen={isSettingsAccordionOpen}
        onSettingsAccordionChange={setIsSettingsAccordionOpen}
        modelSummary={modelSummary}
        showAiSettings={showAiSettings}
        onToggleShowAiSettings={() => setShowAiSettings((prev) => !prev)}
        aiSettings={aiSettings}
        onAiSettingsChange={setAiSettings}
        modelsStatus={modelsStatus}
        availableModels={availableModels}
        isAutoModel={isAutoModel}
        recommendedModel={recommendedModel}
        modelsError={modelsError}
        availableGroups={availableGroups}
        onSaveSettings={() => void handleSaveSettings()}
        settingsMessage={settingsMessage}
        formatBytes={formatBytes}
      />
    </Stack>
  );
};
