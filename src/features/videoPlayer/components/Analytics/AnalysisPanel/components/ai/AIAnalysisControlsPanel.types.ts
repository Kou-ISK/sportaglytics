export type RetrieverPresetValue = 'balanced' | 'labels' | 'memo' | 'time';

export type AnalysisRequestStatus = 'idle' | 'running' | 'done' | 'error';

export interface RetrieverPresetOption {
  value: RetrieverPresetValue;
  label: string;
  helper: string;
}

export interface LlmRetryInfo {
  attempt: number;
  total: number;
  mode: 'reduce' | 'repair';
  reason: string;
}

export interface LlmDebugInfo {
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

export interface AIAnalysisControlsPanelProps {
  questionTemplates: string[];
  question: string;
  setQuestion: (value: string) => void;
  retrieverPreset: RetrieverPresetValue;
  retrieverPresets: RetrieverPresetOption[];
  onRetrieverPresetChange: (value: RetrieverPresetValue) => void;
  generationStatus: AnalysisRequestStatus;
  retrievalStatus: AnalysisRequestStatus;
  handleRetrieveEvidence: () => Promise<void>;
  handleGenerate: (options?: { reuseEvidence?: boolean }) => Promise<void>;
  handleGenerateInsights: () => Promise<void>;
  handleCancelGeneration: () => Promise<void>;
  evidenceItemsCount: number;
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  labelGroup: string;
  setLabelGroup: (value: string) => void;
  labelName: string;
  setLabelName: (value: string) => void;
  availableGroups: string[];
  availableLabels: string[];
  effectiveTeamGroup: string;
  teamName: string;
  setTeamName: (value: string) => void;
  availableTeamLabels: string[];
  retrievalError: string | null;
  generationError: string | null;
  llmRawText: string | null;
  llmLiveLog: string;
  llmRetryInfo: LlmRetryInfo | null;
  llmDebug: LlmDebugInfo | null;
  showDebug: boolean;
  setShowDebug: (value: boolean) => void;
}
