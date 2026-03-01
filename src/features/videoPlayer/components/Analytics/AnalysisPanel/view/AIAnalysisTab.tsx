import React from 'react';
import { Alert, Box, Stack } from '@mui/material';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import type { TimelineData } from '../../../../../../types/TimelineData';
import { AnalysisCard } from './AnalysisCard';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { AIAnalysisClipsPanel } from './ai/AIAnalysisClipsPanel';
import { AIAnalysisControlsPanel } from './ai/AIAnalysisControlsPanel';
import { AIAnalysisConversationPanel } from './ai/AIAnalysisConversationPanel';
import { AIAnalysisInsightsSidebar } from './ai/AIAnalysisInsightsSidebar';
import { AIAnalysisSettingsAccordion } from './ai/AIAnalysisSettingsAccordion';
import {
  formatBytes,
  formatDurationShort,
  formatElapsed,
  formatGapShort,
  formatPercent,
  formatSeconds,
} from './ai/aiAnalysisFormatters';
import {
  EVIDENCE_DEFAULT_VISIBLE_COUNT,
  MAX_LLM_RETRIES,
  RETRIEVER_PRESETS,
  useAIAnalysisTabController,
} from './hooks/useAIAnalysisTabController';

interface AIAnalysisTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
  totalTimelineCount?: number;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const AIAnalysisTab = ({
  hasData,
  timeline,
  emptyMessage,
  totalTimelineCount,
  onCreateAiPlaylist,
  onJumpToSegment,
}: AIAnalysisTabProps) => {
  const {
    aiSettings,
    setAiSettings,
    question,
    setQuestion,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    labelGroup,
    setLabelGroup,
    labelName,
    setLabelName,
    teamName,
    setTeamName,
    showAiSettings,
    setShowAiSettings,
    showFilters,
    setShowFilters,
    showAllEvidence,
    setShowAllEvidence,
    isEvidenceAccordionOpen,
    setIsEvidenceAccordionOpen,
    isInsightAccordionOpen,
    setIsInsightAccordionOpen,
    isSettingsAccordionOpen,
    setIsSettingsAccordionOpen,
    insightDimension,
    setInsightDimension,
    availableModels,
    modelsStatus,
    modelsError,
    retrievalStatus,
    generationStatus,
    retrievalError,
    generationError,
    evidenceItems,
    aiResponse,
    llmRawText,
    llmLiveLog,
    llmAttempt,
    llmRetryInfo,
    llmDebug,
    llmWarning,
    showDebug,
    setShowDebug,
    settingsMessage,
    playlistMessage,
    llmProgress,
    timelineMap,
    availableGroups,
    insightDimensionOptions,
    recommendedModel,
    isAutoModel,
    modelSummary,
    retrieverPreset,
    availableLabels,
    availableTeamLabels,
    effectiveTeamGroup,
    handleSaveSettings,
    handleRetrieveEvidence,
    handleGenerate,
    handleCancelGeneration,
    handleGenerateInsights,
    insightData,
    resolvedInsightLabel,
    evidenceMap,
    validatedHighlights,
    validatedHypotheses,
    validatedClips,
    groundedEvidence,
    visibleEvidenceItems,
    hiddenEvidenceCount,
    hasGroundedOutput,
    clipSegments,
    displayQuestion,
    stripEvidenceIds,
    handleCreatePlaylist,
    questionTemplates,
    accordionSx,
  } = useAIAnalysisTabController({ timeline, onCreateAiPlaylist });

  if (!hasData || timeline.length === 0) {
    if (!hasData) return <NoDataPlaceholder message={emptyMessage} />;
    return <NoDataPlaceholder message="表示できるタイムラインがありません。" />;
  }

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}
      gap={2}
    >
      <Stack spacing={2}>
        <AnalysisCard title="AI分析">
          <Stack spacing={2}>
            <Stack spacing={1.5}>
              {typeof totalTimelineCount === 'number' &&
                totalTimelineCount > timeline.length && (
                  <Alert severity="info">
                    対象タイムライン: {timeline.length}/{totalTimelineCount}
                  </Alert>
                )}

              <AIAnalysisConversationPanel
                displayQuestion={displayQuestion}
                aiResponse={aiResponse}
                generationStatus={generationStatus}
                llmAttempt={llmAttempt}
                maxLlmRetries={MAX_LLM_RETRIES}
                llmRetryInfo={llmRetryInfo}
                llmProgress={llmProgress}
                llmWarning={llmWarning}
                hasGroundedOutput={hasGroundedOutput}
                validatedHypotheses={validatedHypotheses}
                validatedHighlights={validatedHighlights}
                timelineMap={timelineMap}
                stripEvidenceIds={stripEvidenceIds}
                onJumpToSegment={onJumpToSegment}
                formatSeconds={formatSeconds}
                formatElapsed={formatElapsed}
              />
            </Stack>

            <AIAnalysisControlsPanel
              questionTemplates={questionTemplates}
              question={question}
              setQuestion={setQuestion}
              retrieverPreset={retrieverPreset}
              retrieverPresets={RETRIEVER_PRESETS}
              onRetrieverPresetChange={(value) => {
                setAiSettings({
                  ...aiSettings,
                  retrieverPreset: value,
                });
              }}
              generationStatus={generationStatus}
              retrievalStatus={retrievalStatus}
              handleRetrieveEvidence={handleRetrieveEvidence}
              handleGenerate={handleGenerate}
              handleGenerateInsights={handleGenerateInsights}
              handleCancelGeneration={handleCancelGeneration}
              evidenceItemsCount={evidenceItems.length}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
              labelGroup={labelGroup}
              setLabelGroup={setLabelGroup}
              labelName={labelName}
              setLabelName={setLabelName}
              availableGroups={availableGroups}
              availableLabels={availableLabels}
              effectiveTeamGroup={effectiveTeamGroup}
              teamName={teamName}
              setTeamName={setTeamName}
              availableTeamLabels={availableTeamLabels}
              retrievalError={retrievalError}
              generationError={generationError}
              llmRawText={llmRawText}
              llmLiveLog={llmLiveLog}
              llmRetryInfo={llmRetryInfo}
              llmDebug={llmDebug}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
            />
          </Stack>
        </AnalysisCard>

        <AnalysisCard title="クリップ">
          <AIAnalysisClipsPanel
            onCreateAiPlaylist={
              onCreateAiPlaylist ? () => void handleCreatePlaylist() : undefined
            }
            playlistMessage={playlistMessage}
            hasGroundedOutput={hasGroundedOutput}
            aiResponseExists={Boolean(aiResponse)}
            clipSegmentsCount={clipSegments.length}
            validatedClips={validatedClips}
            evidenceMap={evidenceMap}
            stripEvidenceIds={stripEvidenceIds}
            formatSeconds={formatSeconds}
          />
        </AnalysisCard>
      </Stack>

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
    </Box>
  );
};
