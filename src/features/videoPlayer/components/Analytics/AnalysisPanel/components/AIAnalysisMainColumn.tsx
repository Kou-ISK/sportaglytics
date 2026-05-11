import React from 'react';
import { Alert, Stack } from '@mui/material';
import type { AIAnalysisTabViewProps } from './AIAnalysisTabView.types';
import { AnalysisCard } from './AnalysisCard';
import { AIAnalysisClipsPanel } from './ai/AIAnalysisClipsPanel';
import { AIAnalysisControlsPanel } from './ai/AIAnalysisControlsPanel';
import { AIAnalysisConversationPanel } from './ai/AIAnalysisConversationPanel';
import { formatElapsed, formatSeconds } from './ai/aiAnalysisFormatters';
import {
  MAX_LLM_RETRIES,
  RETRIEVER_PRESETS,
} from '../controllers/useAIAnalysisTabController';

export const AIAnalysisMainColumn = (
  props: AIAnalysisTabViewProps,
): React.JSX.Element => {
  const {
    timeline,
    totalTimelineCount,
    onCreateAiPlaylist,
    onJumpToSegment,
    onRetrieverPresetChange,
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
    showFilters,
    setShowFilters,
    availableGroups,
    availableLabels,
    effectiveTeamGroup,
    availableTeamLabels,
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
    playlistMessage,
    llmProgress,
    timelineMap,
    retrieverPreset,
    handleRetrieveEvidence,
    handleGenerate,
    handleCancelGeneration,
    handleGenerateInsights,
    validatedHighlights,
    validatedHypotheses,
    validatedClips,
    hasGroundedOutput,
    clipSegments,
    displayQuestion,
    stripEvidenceIds,
    handleCreatePlaylist,
    questionTemplates,
  } = props;

  return (
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
            onRetrieverPresetChange={onRetrieverPresetChange}
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
          evidenceMap={props.evidenceMap}
          stripEvidenceIds={stripEvidenceIds}
          formatSeconds={formatSeconds}
        />
      </AnalysisCard>
    </Stack>
  );
};
