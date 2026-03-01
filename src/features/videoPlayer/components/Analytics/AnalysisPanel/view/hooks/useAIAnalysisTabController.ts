import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../../../../../../types/Settings';
import type { PlaylistItem } from '../../../../../../../types/Playlist';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import { useSettings } from '../../../../../../../hooks/useSettings';
import {
  buildEvidenceIndex,
  HybridEvidenceRetriever,
  type AiCopilotResponse,
  type EvidenceFilters,
  type EvidenceItem,
} from '../../../../../analysis/ai';
import {
  EVIDENCE_DEFAULT_VISIBLE_COUNT,
  resolveDiversifyTarget,
  RETRIEVER_PRESETS,
  RETRIEVER_WEIGHT_MAP,
} from './aiAnalysis/aiAnalysisUtils';
import { useAIAnalysisGenerationActions } from './aiAnalysis/useAIAnalysisGenerationActions';
import { useAIAnalysisGroundedOutput } from './aiAnalysis/useAIAnalysisGroundedOutput';
import { useAIAnalysisInsightState } from './aiAnalysis/useAIAnalysisInsightState';
import { useAIAnalysisModelState } from './aiAnalysis/useAIAnalysisModelState';
import { useAIAnalysisPlaylistActions } from './aiAnalysis/useAIAnalysisPlaylistActions';
import { useAIAnalysisRetrievalActions } from './aiAnalysis/useAIAnalysisRetrievalActions';

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

  const [aiSettings, setAiSettings] = useState(defaultAiSettings);
  const [question, setQuestion] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [labelGroup, setLabelGroup] = useState('');
  const [labelName, setLabelName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [isEvidenceAccordionOpen, setIsEvidenceAccordionOpen] = useState(true);
  const [isInsightAccordionOpen, setIsInsightAccordionOpen] = useState(false);
  const [isSettingsAccordionOpen, setIsSettingsAccordionOpen] = useState(false);
  const [insightDimension, setInsightDimension] = useState('auto');

  const [retrievalStatus, setRetrievalStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle',
  );
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle',
  );
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [aiResponse, setAiResponse] = useState<AiCopilotResponse | null>(null);
  const [llmRawText, setLlmRawText] = useState<string | null>(null);
  const [llmLiveLog, setLlmLiveLog] = useState('');
  const [llmAttempt, setLlmAttempt] = useState(1);
  const [llmRetryInfo, setLlmRetryInfo] = useState<{
    attempt: number;
    total: number;
    mode: 'reduce' | 'repair';
    reason: string;
  } | null>(null);
  const [llmDebug, setLlmDebug] = useState<{
    stderr?: string;
    binaryPath?: string;
    modelPath?: string;
    durationMs?: number;
  } | null>(null);
  const [llmWarning, setLlmWarning] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [activeFilters, setActiveFilters] = useState<EvidenceFilters | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [playlistMessage, setPlaylistMessage] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [generationRequestId, setGenerationRequestId] = useState<string | null>(null);
  const [llmProgress, setLlmProgress] = useState<{
    requestId: string;
    phase?: string;
    outputChars?: number;
    elapsedMs?: number;
  } | null>(null);

  const generationAbortRef = useRef<AbortController | null>(null);
  const generationRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    setAiSettings(defaultAiSettings);
  }, [defaultAiSettings]);

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

  useEffect(() => {
    if (labelGroup && !availableLabels.includes(labelName)) {
      setLabelName('');
    }
  }, [availableLabels, labelGroup, labelName]);

  useEffect(() => {
    if (teamName && !availableTeamLabels.includes(teamName)) {
      setTeamName('');
    }
  }, [availableTeamLabels, teamName]);

  const handleSaveSettings = useCallback(async () => {
    setSettingsMessage(null);
    const success = await saveSettings({
      ...settings,
      aiAnalysis: aiSettings,
    });
    setSettingsMessage(success ? 'AI設定を保存しました。' : 'AI設定の保存に失敗しました。');
  }, [aiSettings, saveSettings, settings]);

  const retrieverPreset = aiSettings.retrieverPreset ?? 'balanced';
  const retrieverWeights = useMemo(() => {
    return RETRIEVER_WEIGHT_MAP[retrieverPreset] ?? RETRIEVER_WEIGHT_MAP.balanced;
  }, [retrieverPreset]);
  const topK = Math.max(1, aiSettings.topK || 40);
  const evidenceTarget = useMemo(() => resolveDiversifyTarget(topK), [topK]);

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

  const accordionSx = {
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: 'none',
    '&:before': {
      display: 'none',
    },
    '&.Mui-expanded': {
      mt: 0,
    },
  } as const;

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
    accordionSx,
  };
};
