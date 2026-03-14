import { useMemo, useRef } from 'react';
import { DEFAULT_SETTINGS } from '../../../../../../types/Settings';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import type { TimelineData } from '../../../../../../types/TimelineData';
import { useSettings } from '../../../../../../hooks/useSettings';
import {
  buildEvidenceIndex,
  HybridEvidenceRetriever,
} from '../../../../analysis/ai';
import {
  EVIDENCE_DEFAULT_VISIBLE_COUNT,
  RETRIEVER_PRESETS,
} from './aiAnalysis/aiAnalysisUtils';
import { pickAIAnalysisPublicState } from './aiAnalysis/aiAnalysisPublicState';
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

  const tabState = useAIAnalysisTabState({
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
    model: tabState.aiSettings.model ?? 'auto',
    generationRunIdRef,
    setLlmProgress: tabState.setLlmProgress,
    setLlmLiveLog: tabState.setLlmLiveLog,
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
    teamLabelGroup: tabState.aiSettings.teamLabelGroup ?? '',
    startTime: tabState.startTime,
    endTime: tabState.endTime,
    labelGroup: tabState.labelGroup,
    labelName: tabState.labelName,
    teamName: tabState.teamName,
    insightDimension: tabState.insightDimension,
    setInsightDimension: tabState.setInsightDimension,
  });

  useAIAnalysisFilterSync({
    labelGroup: tabState.labelGroup,
    labelName: tabState.labelName,
    availableLabels,
    setLabelName: tabState.setLabelName,
    teamName: tabState.teamName,
    availableTeamLabels,
    setTeamName: tabState.setTeamName,
  });

  const { handleSaveSettings } = useAIAnalysisSettingsActions({
    settings,
    aiSettings: tabState.aiSettings,
    saveSettings,
    setSettingsMessage: tabState.setSettingsMessage,
  });

  const { retrieverPreset, retrieverWeights, topK, evidenceTarget } =
    useAIAnalysisRetrieverConfig(tabState.aiSettings);

  const { handleRetrieveEvidence, ensureEvidence } = useAIAnalysisRetrievalActions({
    question: tabState.question,
    buildFilters,
    retriever,
    evidenceIndex,
    topK,
    retrieverWeights,
    evidenceTarget,
    flowEvidenceIds,
    setRetrievalError: tabState.setRetrievalError,
    setGenerationError: tabState.setGenerationError,
    setPlaylistMessage: tabState.setPlaylistMessage,
    setRetrievalStatus: tabState.setRetrievalStatus,
    setAiResponse: tabState.setAiResponse,
    setLlmRawText: tabState.setLlmRawText,
    setLlmDebug: tabState.setLlmDebug,
    setLlmWarning: tabState.setLlmWarning,
    setEvidenceItems: tabState.setEvidenceItems,
    setActiveFilters: tabState.setActiveFilters,
    setLastQuestion: tabState.setLastQuestion,
    setEvidenceQuery: tabState.setEvidenceQuery,
  });

  const { handleGenerate, handleCancelGeneration, handleGenerateInsights } =
    useAIAnalysisGenerationActions({
      question: tabState.question,
      aiSettings: tabState.aiSettings,
      timeline,
      resolvedInsightDimension,
      teamGroupForFacts,
      evidenceTarget,
      evidenceItems: tabState.evidenceItems,
      evidenceQuery: tabState.evidenceQuery,
      activeFilters: tabState.activeFilters,
      insightEvidenceItems,
      buildFilters,
      ensureEvidence,
      generationStatus: tabState.generationStatus,
      generationRequestId: tabState.generationRequestId,
      generationRunIdRef,
      generationAbortRef,
      setGenerationError: tabState.setGenerationError,
      setPlaylistMessage: tabState.setPlaylistMessage,
      setGenerationStatus: tabState.setGenerationStatus,
      setAiResponse: tabState.setAiResponse,
      setLlmRawText: tabState.setLlmRawText,
      setLlmLiveLog: tabState.setLlmLiveLog,
      setLlmAttempt: tabState.setLlmAttempt,
      setLlmRetryInfo: tabState.setLlmRetryInfo,
      setLlmDebug: tabState.setLlmDebug,
      setLlmWarning: tabState.setLlmWarning,
      setLastQuestion: tabState.setLastQuestion,
      setGenerationRequestId: tabState.setGenerationRequestId,
      setLlmProgress: tabState.setLlmProgress,
      setEvidenceItems: tabState.setEvidenceItems,
      setActiveFilters: tabState.setActiveFilters,
      setRetrievalStatus: tabState.setRetrievalStatus,
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
    aiResponse: tabState.aiResponse,
    evidenceItems: tabState.evidenceItems,
    insightData,
    showAllEvidence: tabState.showAllEvidence,
    setShowAllEvidence: tabState.setShowAllEvidence,
    question: tabState.question,
    lastQuestion: tabState.lastQuestion,
    generationStatus: tabState.generationStatus,
  });

  const { handleCreatePlaylist } = useAIAnalysisPlaylistActions({
    clipSegments,
    evidenceMap,
    onCreateAiPlaylist,
    setPlaylistMessage: tabState.setPlaylistMessage,
  });

  return {
    ...pickAIAnalysisPublicState(tabState),
    availableModels,
    modelsStatus,
    modelsError,
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
