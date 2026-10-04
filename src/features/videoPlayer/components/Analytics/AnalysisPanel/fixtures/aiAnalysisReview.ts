import type { ComponentProps } from 'react';
import type { AIAnalysisControlsPanelProps } from '../components/ai/AIAnalysisControlsPanel.types';
import type { AIAnalysisConversationPanel } from '../components/ai/AIAnalysisConversationPanel';
import { RETRIEVER_PRESETS } from '../controllers/aiAnalysis/aiAnalysisUtils';
import {
  formatElapsed,
  formatSeconds,
} from '../components/ai/aiAnalysisFormatters';
import { reviewTimeline } from './reviewTimeline';

export const reviewAiControls: AIAnalysisControlsPanelProps = {
  questionTemplates: ['Redの攻撃を振り返る', '試合の重要場面を挙げる'],
  question: 'Redの攻撃を振り返る',
  setQuestion: () => {},
  retrieverPreset: 'balanced',
  retrieverPresets: RETRIEVER_PRESETS,
  onRetrieverPresetChange: () => {},
  generationStatus: 'idle',
  retrievalStatus: 'idle',
  handleRetrieveEvidence: async () => {},
  handleGenerate: async () => {},
  handleGenerateInsights: async () => {},
  handleCancelGeneration: async () => {},
  evidenceItemsCount: 0,
  showFilters: false,
  setShowFilters: () => {},
  startTime: '',
  setStartTime: () => {},
  endTime: '',
  setEndTime: () => {},
  labelGroup: '',
  setLabelGroup: () => {},
  labelName: '',
  setLabelName: () => {},
  availableGroups: ['Result', 'Type'],
  availableLabels: ['Try', '継続'],
  effectiveTeamGroup: '',
  teamName: '',
  setTeamName: () => {},
  availableTeamLabels: [],
  retrievalError: null,
  generationError: null,
  llmRawText: null,
  llmLiveLog: '',
  llmRetryInfo: null,
  llmDebug: null,
  showDebug: false,
  setShowDebug: () => {},
};

export const reviewAiResult: ComponentProps<
  typeof AIAnalysisConversationPanel
> = {
  displayQuestion: 'Redの攻撃を振り返る',
  aiResponse: {
    summary: 'これは合成データを用いた画面確認用の回答です。',
    hypotheses: [
      { text: '中央からの攻撃を確認します。', evidenceIds: ['synthetic-0'] },
    ],
    evidenceHighlights: [
      { id: 'synthetic-0', why: '開始直後のポゼッションを確認します。' },
    ],
    recommendedClips: [],
  },
  generationStatus: 'done',
  llmAttempt: 1,
  maxLlmRetries: 1,
  llmRetryInfo: null,
  llmProgress: null,
  llmWarning: null,
  hasGroundedOutput: true,
  validatedHypotheses: [
    { text: '中央からの攻撃を確認します。', evidenceIds: ['synthetic-0'] },
  ],
  validatedHighlights: [
    { id: 'synthetic-0', why: '開始直後のポゼッションを確認します。' },
  ],
  timelineMap: new Map(reviewTimeline.map((entry) => [entry.id, entry])),
  stripEvidenceIds: (text) => text,
  onJumpToSegment: () => {},
  formatSeconds,
  formatElapsed,
};
