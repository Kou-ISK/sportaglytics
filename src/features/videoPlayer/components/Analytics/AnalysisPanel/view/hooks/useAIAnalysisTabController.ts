import { useMemo, useRef } from 'react';
import { DEFAULT_SETTINGS } from '../../../../../../../types/Settings';
import type { PlaylistItem } from '../../../../../../../types/Playlist';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import { useSettings } from '../../../../../../../hooks/useSettings';
import {
  buildEvidenceIndex,
  HybridEvidenceRetriever,
} from '../../../../../analysis/ai';
import {
  EVIDENCE_DEFAULT_VISIBLE_COUNT,
  RETRIEVER_PRESETS,
} from './aiAnalysis/aiAnalysisUtils';
import { AI_ANALYSIS_ACCORDION_SX } from './aiAnalysis/aiAnalysisViewConstants';
import { useAIAnalysisGenerationActions } from './aiAnalysis/useAIAnalysisGenerationActions';
import { useAIAnalysisFilterSync } from './aiAnalysis/useAIAnalysisFilterSync';
import { useAIAnalysisGroundedOutput } from './aiAnalysis/useAIAnalysisGroundedOutput';
import { useAIAnalysisInsightState } from './aiAnalysis/useAIAnalysisInsightState';
import { useAIAnalysisModelState } from './aiAnalysis/useAIAnalysisModelState';
import { useAIAnalysisPlaylistActions } from './aiAnalysis/useAIAnalysisPlaylistActions';
import { useAIAnalysisRetrieverConfig } from './aiAnalysis/useAIAnalysisRetrieverConfig';
import { useAIAnalysisRetrievalActions } from './aiAnalysis/useAIAnalysisRetrievalActions';
import { useAIAnalysisSettingsActions } from './aiAnalysis/useAIAnalysisSettingsActions';
import { useAIAnalysisTabState } from './aiAnalysis/useAIAnalysisTabState';

interface UseAIAnalysisTabControllerParams {
  timeline: TimelineData[];
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
}

export const MAX_LLM_RETRIES = 1;
export { EVIDENCE_DEFAULT_VISIBLE_COUNT, RETRIEVER_PRESETS };

export const useAIAnalysisTabController = ({
  timeline,
  onCreateAiPlaylist,
}: UseAIAnalysisTabControllerParams) => {
  const { settings, saveSettings } = useSettings();
  const defaultAiSettings =
    settings.aiAnalysis ??
    DEFAULT_SETTINGS.aiAnalysis ?? {
      provider: 'llama.cpp',
      baseUrl: 'http://localhost:11434',
      model: 'auto',
      temperature: 0.2,
      topK: 40,
      embeddingEnabled: false,
      teamLabelGroup: '',
      retrieverPreset: 'balanced',
    };

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
    retrievalStatus,
    setRetrievalStatus,
    generationStatus,
    setGenerationStatus,
    retrievalError,
    setRetrievalError,
    generationError,
    setGenerationError,
    evidenceItems,
    setEvidenceItems,
    aiResponse,
    setAiResponse,
    llmRawText,
    setLlmRawText,
    llmLiveLog,
    setLlmLiveLog,
    llmAttempt,
    setLlmAttempt,
    llmRetryInfo,
    setLlmRetryInfo,
    llmDebug,
    setLlmDebug,
    llmWarning,
    setLlmWarning,
    showDebug,
    setShowDebug,
    activeFilters,
    setActiveFilters,
    settingsMessage,
    setSettingsMessage,
    playlistMessage,
    setPlaylistMessage,
    lastQuestion,
    setLastQuestion,
    evidenceQuery,
    setEvidenceQuery,
    generationRequestId,
    setGenerationRequestId,
    llmProgress,
    setLlmProgress,
  } = useAIAnalysisTabState({
    defaultAiSettings,
  });

  const generationAbortRef = useRef<AbortController | null>(null);
  const generationRunIdRef = useRef<string | null>(null);

  const evidenceIndex = useMemo(() => buildEvidenceIndex(timeline), [timeline]);
  const retriever = useMemo(() => new HybridEvidenceRetriever(), []);
  const timelineMap = useMemo(() => new Map(timeline.map((item) => [item.id, item])), [timeline]);

  const {
    availableModels,
    modelsStatus,
    modelsError,
    recommendedModel,
    isAutoModel,
    modelSummary,
  } = useAIAnalysisModelState({
    model: aiSettings.model ?? 'auto',
    generationRunIdRef,
    setLlmProgress,
    setLlmLiveLog,
  });

  const {
    availableGroups,
    availableLabels,
    availableTeamLabels,
    effectiveTeamGroup,
    teamGroupForFacts,
    insightDimensionOptions,
    resolvedInsightDimension,
    resolvedInsightLabel,
    insightData,
    insightEvidenceItems,
    flowEvidenceIds,
    questionTemplates,
    buildFilters,
  } = useAIAnalysisInsightState({
    timeline,
    evidenceById: evidenceIndex.byId,
    teamLabelGroup: aiSettings.teamLabelGroup ?? '',
    startTime,
    endTime,
    labelGroup,
    labelName,
    teamName,
    insightDimension,
    setInsightDimension,
  });

  useAIAnalysisFilterSync({
    labelGroup,
    labelName,
    availableLabels,
    setLabelName,
    teamName,
    availableTeamLabels,
    setTeamName,
  });

  const { handleSaveSettings } = useAIAnalysisSettingsActions({
    settings,
    aiSettings,
    saveSettings,
    setSettingsMessage,
  });

  const { retrieverPreset, retrieverWeights, topK, evidenceTarget } =
    useAIAnalysisRetrieverConfig(aiSettings);

  const { handleRetrieveEvidence, ensureEvidence } = useAIAnalysisRetrievalActions({
    question,
    buildFilters,
    retriever,
    evidenceIndex,
    topK,
    retrieverWeights,
    evidenceTarget,
    flowEvidenceIds,
    setRetrievalError,
    setGenerationError,
    setPlaylistMessage,
    setRetrievalStatus,
    setAiResponse,
    setLlmRawText,
    setLlmDebug,
    setLlmWarning,
    setEvidenceItems,
    setActiveFilters,
    setLastQuestion,
    setEvidenceQuery,
  });

  const { handleGenerate, handleCancelGeneration, handleGenerateInsights } =
    useAIAnalysisGenerationActions({
      question,
      aiSettings,
      timeline,
      resolvedInsightDimension,
      teamGroupForFacts,
      evidenceTarget,
      evidenceItems,
      evidenceQuery,
      activeFilters,
      insightEvidenceItems,
      buildFilters,
      ensureEvidence,
      generationStatus,
      generationRequestId,
      generationRunIdRef,
      generationAbortRef,
      setGenerationError,
      setPlaylistMessage,
      setGenerationStatus,
      setAiResponse,
      setLlmRawText,
      setLlmLiveLog,
      setLlmAttempt,
      setLlmRetryInfo,
      setLlmDebug,
      setLlmWarning,
      setLastQuestion,
      setGenerationRequestId,
      setLlmProgress,
      setEvidenceItems,
      setActiveFilters,
      setRetrievalStatus,
    });

  const {
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
  } = useAIAnalysisGroundedOutput({
    aiResponse,
    evidenceItems,
    insightData,
    showAllEvidence,
    setShowAllEvidence,
    question,
    lastQuestion,
    generationStatus,
  });

  const { handleCreatePlaylist } = useAIAnalysisPlaylistActions({
    clipSegments,
    evidenceMap,
    onCreateAiPlaylist,
    setPlaylistMessage,
  });

  return {
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
    generationRequestId,
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
    accordionSx: AI_ANALYSIS_ACCORDION_SX,
  };
};
