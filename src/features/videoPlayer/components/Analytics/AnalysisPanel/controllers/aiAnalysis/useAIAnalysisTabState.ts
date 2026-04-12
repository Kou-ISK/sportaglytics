import { useEffect, useState } from 'react';
import type { AIAnalysisSettings } from '../../../../../../../types/Settings';
import type {
  AiCopilotResponse,
  EvidenceFilters,
  EvidenceItem,
} from '../../../../../analysis/ai';

type RunStatus = 'idle' | 'running' | 'done' | 'error';

interface UseAIAnalysisTabStateParams {
  defaultAiSettings: AIAnalysisSettings;
}

export const useAIAnalysisTabState = ({
  defaultAiSettings,
}: UseAIAnalysisTabStateParams) => {
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

  const [retrievalStatus, setRetrievalStatus] = useState<RunStatus>('idle');
  const [generationStatus, setGenerationStatus] = useState<RunStatus>('idle');
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
  const [activeFilters, setActiveFilters] = useState<EvidenceFilters | null>(
    null,
  );
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [playlistMessage, setPlaylistMessage] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [generationRequestId, setGenerationRequestId] = useState<string | null>(
    null,
  );
  const [llmProgress, setLlmProgress] = useState<{
    requestId: string;
    phase?: string;
    outputChars?: number;
    elapsedMs?: number;
  } | null>(null);

  useEffect(() => {
    setAiSettings(defaultAiSettings);
  }, [defaultAiSettings]);

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
  };
};
