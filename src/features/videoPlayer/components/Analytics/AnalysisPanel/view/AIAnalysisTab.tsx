import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  InputBase,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import { useSettings } from '../../../../../../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../../../../../../types/Settings';
import {
  extractUniqueGroups,
  extractUniqueLabelsForGroup,
  getLabelsFromTimelineData,
} from '../../../../../../utils/labelExtractors';
import {
  buildEvidenceIndex,
  buildClipSegments,
  generateAiResponse,
  HybridEvidenceRetriever,
  type EvidenceFilters,
  type EvidenceItem,
  type RetrieverWeights,
  type AiCopilotResponse,
  type AiEvidenceHighlight,
  type AiHypothesis,
  type AiRecommendedClip,
} from '../../../../analysis/ai';
import {
  buildAiInsightFacts,
  buildEventInsights,
  filterTimelineByEvidenceFilters,
  type InsightDimension,
  type EventInsights,
} from '../../../../analysis/utils/eventInsights';
import { AnalysisCard } from './AnalysisCard';
import { NoDataPlaceholder } from './NoDataPlaceholder';

interface AIAnalysisTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
  onJumpToSegment?: (segment: TimelineData) => void;
}

const formatSeconds = (value: number) => {
  if (!Number.isFinite(value)) return '--:--';
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '--';
  const gb = value / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = value / 1024 ** 2;
  return `${mb.toFixed(1)} MB`;
};

const parseNumberInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapEvidenceToTimeline = (items: EvidenceItem[]): TimelineData[] =>
  items.map((item) => ({
    id: item.id,
    actionName: item.actionName,
    startTime: item.startTime,
    endTime: item.endTime,
    memo: item.memo,
    labels: item.labels,
  }));

const formatPercent = (value: number, digits: number = 1) => {
  if (!Number.isFinite(value)) return '--';
  return `${(value * 100).toFixed(digits)}%`;
};

const formatDurationShort = (value: number) => {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}秒`;
};

const formatGapShort = (value: number) => {
  if (!Number.isFinite(value)) return '--';
  const rounded = Math.round(value * 10) / 10;
  if (rounded >= 0) return `${rounded.toFixed(1)}秒`;
  return `${rounded.toFixed(1)}秒(重なり)`;
};

const AUTO_INSIGHT_QUESTION =
  '全体の傾向と特徴的なイベントを要約し、根拠付きで仮説とクリップ候補を提示してください。';
const MAX_LLM_RETRIES = 1;
const LLM_TOP_P = 0.85;
const LLM_TOP_K = 40;
const LLM_REPEAT_PENALTY = 1.1;

const DEFAULT_QUESTION_TEMPLATES = [
  '重要な流れの変化点は？',
  '頻出アクションの流れは？',
  '前半/中盤/後半で偏りは？',
  '直前・直後で目立つ出来事は？',
  '長く続いた出来事は？',
];

const TEAM_SPLIT_REGEX = /[\s\u3000/／・\\\-–—_]+/;

const splitTeamActionName = (
  actionName: string,
): { team: string; action: string } | null => {
  const trimmed = (actionName ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(TEAM_SPLIT_REGEX).filter(Boolean);
  if (parts.length < 2) return null;
  const team = parts[0]?.trim();
  const action = parts.slice(1).join(' ').trim();
  if (!team || !action) return null;
  if (/^[\d\W]+$/.test(team)) return null;
  return { team, action };
};

const buildQuestionTemplates = (timeline: TimelineData[]): string[] => {
  if (!timeline || timeline.length === 0) return DEFAULT_QUESTION_TEMPLATES;

  const actionCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();
  const teamCounts = new Map<string, number>();
  const actionScores = new Map<string, number>();
  const markAction = (name: string, increment: number, teamHit: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    actionCounts.set(trimmed, (actionCounts.get(trimmed) ?? 0) + increment);
    const score =
      (actionScores.get(trimmed) ?? 0) + increment + (teamHit ? -0.5 : 0);
    actionScores.set(trimmed, score);
  };

  for (const item of timeline) {
    const actionName = item.actionName?.trim();
    if (actionName) {
      const parsed = splitTeamActionName(actionName);
      if (parsed?.team) {
        teamCounts.set(parsed.team, (teamCounts.get(parsed.team) ?? 0) + 1);
        if (parsed.action) {
          markAction(parsed.action, 1, true);
        }
      } else {
        markAction(actionName, 1, false);
      }
    }
    const labels = getLabelsFromTimelineData(item);
    for (const label of labels) {
      const key = label.name?.trim();
      if (!key) continue;
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }
  }

  const topActions = Array.from(actionCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      score: actionScores.get(name) ?? count,
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .map((entry) => entry.name)
    .filter((name) => !splitTeamActionName(name))
    .slice(0, 3);
  const topLabels = Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 3);
  const topTeams = Array.from(teamCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 2);

  const templates: string[] = [];
  const add = (text: string) => {
    if (!templates.includes(text)) templates.push(text);
  };

  if (topActions[0]) {
    add(`${topActions[0]} が切り替わる前後の流れは？`);
    add(`${topActions[0]} の直前・直後に多い出来事は？`);
    add(`${topActions[0]} が起きやすい時間帯は？（前半/中盤/後半）`);
    add(`${topActions[0]} の結果に偏りはある？（成功/失敗など）`);
    if (topActions[1]) {
      add(`${topActions[1]} が切り替わる前後の流れは？`);
    }
  }
  if (topLabels[0]) {
    add(`「${topLabels[0]}」が起きやすい時間帯は？（前半/中盤/後半）`);
    add(`「${topLabels[0]}」の前後で多い出来事は？`);
  }
  if (topTeams.length >= 2) {
    add(`${topTeams[0]} と ${topTeams[1]} で【対象】の偏りは？`);
  } else if (topTeams[0]) {
    add(`${topTeams[0]} の【対象】傾向は？`);
  }

  if (templates.length < 4) {
    DEFAULT_QUESTION_TEMPLATES.forEach((template) => add(template));
  }

  return templates.slice(0, 6);
};

const RETRIEVER_PRESETS: Array<{
  value: 'balanced' | 'labels' | 'memo' | 'time';
  label: string;
  helper: string;
}> = [
  { value: 'balanced', label: 'バランス', helper: '全体を均等に評価' },
  { value: 'labels', label: 'ラベル重視', helper: 'ラベル一致を重視' },
  { value: 'memo', label: 'メモ重視', helper: 'メモ一致を重視' },
  { value: 'time', label: '時間重視', helper: '時間条件を重視' },
];

const RETRIEVER_WEIGHT_MAP: Record<
  (typeof RETRIEVER_PRESETS)[number]['value'],
  RetrieverWeights
> = {
  balanced: { token: 1, label: 1.6, memo: 1.1, time: 1.2, rareLabel: 0.6 },
  labels: { token: 0.9, label: 2.2, memo: 0.9, time: 1.1, rareLabel: 0.7 },
  memo: { token: 0.8, label: 1.2, memo: 2.0, time: 1.1, rareLabel: 0.7 },
  time: { token: 0.7, label: 1.1, memo: 0.9, time: 2.2, rareLabel: 0.7 },
};

const resolveDiversifyTarget = (topK: number) => {
  if (topK <= 24) return Math.max(1, topK);
  return Math.min(30, Math.max(24, Math.floor(topK * 0.7)));
};

const formatElapsed = (ms?: number) => {
  if (!ms || !Number.isFinite(ms)) return '';
  return `${(ms / 1000).toFixed(1)}秒`;
};

const collectInsightEvidenceIds = (insight: EventInsights): string[] => {
  const ids = new Set<string>();
  insight.topStates.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.topTransitions.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.topSequences.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.streaks.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.rareStates.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.longestEvents.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  return Array.from(ids);
};

const collectFlowEvidenceIds = (insight: EventInsights): string[] => {
  const ids = new Set<string>();
  insight.topTransitions.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.topSequences.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  if (insight.topSequencesByLength) {
    Object.values(insight.topSequencesByLength).forEach((stats) => {
      stats.forEach((stat) => stat.evidenceIds.forEach((id) => ids.add(id)));
    });
  }
  return Array.from(ids);
};

const buildPlaylistName = () => {
  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `AI Review: ${timestamp}`;
};

const normalizeEvidenceId = (value: string) => value.trim();

type AvailableModelInfo = {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
};

export const AIAnalysisTab = ({
  hasData,
  timeline,
  emptyMessage,
  onCreateAiPlaylist,
  onJumpToSegment,
}: AIAnalysisTabProps) => {
  const { settings, saveSettings } = useSettings();
  const defaultAiSettings = settings.aiAnalysis ??
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
  const [insightDimension, setInsightDimension] = useState('auto');
  const [availableModels, setAvailableModels] = useState<AvailableModelInfo[]>(
    [],
  );
  const [modelsStatus, setModelsStatus] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle');
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [retrievalStatus, setRetrievalStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle');
  const [generationStatus, setGenerationStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle');
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
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    setAiSettings(defaultAiSettings);
  }, [defaultAiSettings]);

  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      const llamaApi = globalThis.window?.electronAPI?.llama;
      if (!llamaApi?.listModels) {
        return;
      }
      setModelsStatus('loading');
      setModelsError(null);
      try {
        const models = await llamaApi.listModels();
        if (!mounted) return;
        const sorted = [...(models ?? [])].sort(
          (a, b) => b.sizeBytes - a.sizeBytes,
        );
        setAvailableModels(sorted);
        setModelsStatus('done');
      } catch (error) {
        if (!mounted) return;
        console.debug('[AI] model list failed', error);
        setModelsError('モデル一覧の取得に失敗しました。');
        setModelsStatus('error');
      }
    };
    loadModels();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const llamaApi = globalThis.window?.electronAPI?.llama;
    if (!llamaApi?.onProgress) return;
    const handleProgress = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        requestId?: string;
        phase?: string;
        outputChars?: number;
        elapsedMs?: number;
        stderrChunk?: string;
        stdoutChunk?: string;
      };
      if (!data.requestId || data.requestId !== generationRunIdRef.current) {
        return;
      }
      setLlmProgress({
        requestId: data.requestId,
        phase: data.phase,
        outputChars: data.outputChars,
        elapsedMs: data.elapsedMs,
      });
      if (data.stderrChunk) {
        setLlmLiveLog((prev) => {
          const next = `${prev}${data.stderrChunk}`;
          if (next.length <= 8000) return next;
          return next.slice(-8000);
        });
      }
    };
    llamaApi.onProgress(handleProgress);
    return () => {
      llamaApi.offProgress?.(handleProgress);
    };
  }, []);

  const evidenceIndex = useMemo(() => buildEvidenceIndex(timeline), [timeline]);
  const retriever = useMemo(() => new HybridEvidenceRetriever(), []);
  const timelineMap = useMemo(
    () => new Map(timeline.map((item) => [item.id, item])),
    [timeline],
  );

  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );

  const insightDimensionOptions = useMemo(() => {
    return [
      { value: 'auto', label: '自動' },
      { value: 'action', label: 'アクション名' },
      ...availableGroups.map((group) => ({
        value: `label:${group}`,
        label: `ラベル:${group}`,
      })),
    ];
  }, [availableGroups]);

  useEffect(() => {
    if (!insightDimension.startsWith('label:')) return;
    const group = insightDimension.replace('label:', '');
    if (!availableGroups.includes(group)) {
      setInsightDimension('auto');
    }
  }, [availableGroups, insightDimension]);

  const recommendedModel = useMemo(() => {
    if (availableModels.length === 0) return null;
    return availableModels[0];
  }, [availableModels]);

  const isAutoModel = aiSettings.model?.trim().toLowerCase() === 'auto';

  const modelSummary = useMemo(() => {
    if (isAutoModel) {
      return recommendedModel
        ? `auto (推奨: ${recommendedModel.name})`
        : 'auto';
    }
    return aiSettings.model;
  }, [aiSettings.model, isAutoModel, recommendedModel]);

  const retrieverPreset = aiSettings.retrieverPreset ?? 'balanced';
  const retrieverWeights = useMemo(() => {
    return (
      RETRIEVER_WEIGHT_MAP[retrieverPreset] ?? RETRIEVER_WEIGHT_MAP.balanced
    );
  }, [retrieverPreset]);
  const topK = Math.max(1, aiSettings.topK || 40);
  const evidenceTarget = useMemo(() => resolveDiversifyTarget(topK), [topK]);

  const effectiveTeamGroup = useMemo(() => {
    if (aiSettings.teamLabelGroup) return aiSettings.teamLabelGroup;
    const detected = availableGroups.find(
      (group) => group.toLowerCase() === 'team',
    );
    return detected ?? '';
  }, [aiSettings.teamLabelGroup, availableGroups]);
  const teamGroupForFacts = useMemo(() => {
    if (!effectiveTeamGroup) return '';
    return availableGroups.includes(effectiveTeamGroup)
      ? effectiveTeamGroup
      : '';
  }, [availableGroups, effectiveTeamGroup]);

  const availableLabels = useMemo(() => {
    if (!labelGroup) return [];
    return extractUniqueLabelsForGroup(timeline, labelGroup);
  }, [timeline, labelGroup]);

  const availableTeamLabels = useMemo(() => {
    if (!effectiveTeamGroup) return [];
    return extractUniqueLabelsForGroup(timeline, effectiveTeamGroup);
  }, [timeline, effectiveTeamGroup]);

  useEffect(() => {
    if (labelGroup && !availableLabels.includes(labelName)) {
      setLabelName('');
    }
  }, [labelGroup, availableLabels, labelName]);

  useEffect(() => {
    if (teamName && !availableTeamLabels.includes(teamName)) {
      setTeamName('');
    }
  }, [teamName, availableTeamLabels]);

  const handleSaveSettings = useCallback(async () => {
    setSettingsMessage(null);
    const success = await saveSettings({
      ...settings,
      aiAnalysis: aiSettings,
    });
    setSettingsMessage(
      success ? 'AI設定を保存しました。' : 'AI設定の保存に失敗しました。',
    );
  }, [aiSettings, saveSettings, settings]);

  const buildFilters = useCallback((): EvidenceFilters => {
    const filters: EvidenceFilters = {
      timeRange: {
        start: parseNumberInput(startTime),
        end: parseNumberInput(endTime),
      },
      labelFilters: [],
    };

    if (effectiveTeamGroup && teamName) {
      filters.labelFilters?.push({
        group: effectiveTeamGroup,
        name: teamName,
      });
    }

    if (labelGroup) {
      filters.labelFilters?.push({
        group: labelGroup,
        name: labelName || undefined,
      });
    }

    return filters;
  }, [effectiveTeamGroup, teamName, labelGroup, labelName, startTime, endTime]);

  const parseInsightDimension = useCallback((): InsightDimension => {
    if (insightDimension.startsWith('label:')) {
      const group = insightDimension.replace('label:', '');
      return { type: 'labelGroup', group };
    }
    return { type: 'action' };
  }, [insightDimension]);

  const insightFilters = useMemo(() => buildFilters(), [buildFilters]);
  const insightTimeline = useMemo(
    () => filterTimelineByEvidenceFilters(timeline, insightFilters),
    [timeline, insightFilters],
  );
  const questionTemplates = useMemo(
    () => buildQuestionTemplates(timeline),
    [timeline],
  );
  const resolvedInsightDimension = useMemo<InsightDimension>(() => {
    if (insightDimension !== 'auto') {
      return parseInsightDimension();
    }
    if (insightTimeline.length === 0 || availableGroups.length === 0) {
      return { type: 'action' };
    }
    let bestGroup = '';
    let bestScore = 0;
    for (const group of availableGroups) {
      let withLabel = 0;
      const values = new Set<string>();
      for (const item of insightTimeline) {
        const labels = getLabelsFromTimelineData(item);
        const label = labels.find(
          (entry) => (entry.group ?? '').toLowerCase() === group.toLowerCase(),
        );
        if (label?.name) {
          withLabel += 1;
          values.add(label.name);
        }
      }
      const coverage = withLabel / insightTimeline.length;
      if (coverage < 0.3) continue;
      const diversity =
        values.size / Math.max(2, Math.sqrt(insightTimeline.length));
      const score = coverage * 0.7 + Math.min(1, diversity) * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }
    return bestGroup
      ? { type: 'labelGroup', group: bestGroup }
      : { type: 'action' };
  }, [
    availableGroups,
    insightDimension,
    insightTimeline,
    parseInsightDimension,
  ]);
  const resolvedInsightLabel = useMemo(() => {
    if (resolvedInsightDimension.type === 'labelGroup') {
      return `ラベル:${resolvedInsightDimension.group}`;
    }
    return 'アクション名';
  }, [resolvedInsightDimension]);
  const insightData = useMemo(
    () =>
      buildEventInsights(insightTimeline, {
        dimension: resolvedInsightDimension,
        topN: 5,
        sequenceLength: 3,
        sequenceLengths: [3, 4],
        teamGroup: teamGroupForFacts,
        normalizeTeamActions: true,
      }),
    [insightTimeline, resolvedInsightDimension, teamGroupForFacts],
  );
  const insightEvidenceItems = useMemo(() => {
    const ids = collectInsightEvidenceIds(insightData);
    return ids
      .map((id) => evidenceIndex.byId.get(id))
      .filter(Boolean) as EvidenceItem[];
  }, [evidenceIndex.byId, insightData]);

  const flowEvidenceIds = useMemo(
    () => collectFlowEvidenceIds(insightData),
    [insightData],
  );

  const handleRetrieveEvidence = useCallback(async () => {
    setRetrievalError(null);
    setGenerationError(null);
    setPlaylistMessage(null);
    setRetrievalStatus('running');
    setAiResponse(null);
    setLlmRawText(null);
    setLlmDebug(null);
    setLlmWarning(null);
    setEvidenceItems([]);
    setActiveFilters(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setRetrievalError('質問を入力してください。');
      setRetrievalStatus('error');
      return;
    }
    setLastQuestion(trimmedQuestion);
    setEvidenceQuery(trimmedQuestion);

    const filters = buildFilters();

    try {
      const items = retriever.retrieve(trimmedQuestion, evidenceIndex, {
        topK,
        timeRange: filters.timeRange,
        labelFilters: filters.labelFilters,
        weights: retrieverWeights,
        diversify: { maxEvidence: evidenceTarget },
        insightEvidenceIds: flowEvidenceIds,
      });
      setEvidenceItems(items);
      setActiveFilters(filters);
      setRetrievalStatus('done');
      if (items.length === 0) {
        setRetrievalError('該当する根拠が見つかりませんでした。');
      }
    } catch (error) {
      console.debug('[AI] retrieval failed', error);
      setRetrievalError(
        error instanceof Error
          ? error.message
          : '根拠の検索でエラーが発生しました。',
      );
      setRetrievalStatus('error');
    }
  }, [
    buildFilters,
    evidenceIndex,
    evidenceTarget,
    flowEvidenceIds,
    question,
    retriever,
    retrieverWeights,
    topK,
  ]);

  const ensureEvidence = useCallback(async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      throw new Error('質問を入力してください。');
    }
    setRetrievalStatus('running');
    const filters = buildFilters();
    try {
      const items = retriever.retrieve(trimmedQuestion, evidenceIndex, {
        topK,
        timeRange: filters.timeRange,
        labelFilters: filters.labelFilters,
        weights: retrieverWeights,
        diversify: { maxEvidence: evidenceTarget },
        insightEvidenceIds: flowEvidenceIds,
      });
      setEvidenceItems(items);
      setActiveFilters(filters);
      setRetrievalStatus('done');
      if (items.length === 0) {
        setRetrievalError('該当する根拠が見つかりませんでした。');
        setRetrievalStatus('error');
        throw new Error('該当する根拠が見つかりませんでした。');
      }
      setEvidenceQuery(trimmedQuestion);
      return { items, filters };
    } catch (error) {
      setRetrievalStatus('error');
      if (error instanceof Error) {
        setRetrievalError(error.message);
      } else {
        setRetrievalError('根拠の検索でエラーが発生しました。');
      }
      throw error;
    }
  }, [
    buildFilters,
    evidenceIndex,
    evidenceTarget,
    flowEvidenceIds,
    question,
    retriever,
    retrieverWeights,
    topK,
  ]);

  const handleGenerate = useCallback(
    async (options?: { reuseEvidence?: boolean }) => {
      setGenerationError(null);
      setPlaylistMessage(null);
      setGenerationStatus('running');
      setAiResponse(null);
      setLlmRawText(null);
      setLlmLiveLog('');
      setLlmAttempt(1);
      setLlmRetryInfo(null);
      setLlmDebug(null);
      setLlmWarning(null);

      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        setGenerationError('質問を入力してください。');
        setGenerationStatus('error');
        return;
      }
      setLastQuestion(trimmedQuestion);

      const runId = crypto.randomUUID();
      generationRunIdRef.current = runId;
      setGenerationRequestId(runId);
      setLlmProgress({
        requestId: runId,
        phase: 'start',
        outputChars: 0,
        elapsedMs: 0,
      });
      generationAbortRef.current?.abort();
      const controller = new AbortController();
      generationAbortRef.current = controller;

      const temperature = Number.isFinite(aiSettings.temperature)
        ? aiSettings.temperature
        : 0.2;

      try {
        const shouldReuse =
          options?.reuseEvidence &&
          evidenceItems.length > 0 &&
          evidenceQuery === trimmedQuestion;
        const ensured = shouldReuse
          ? { items: evidenceItems, filters: activeFilters ?? buildFilters() }
          : await ensureEvidence();
        if (generationRunIdRef.current !== runId) return;
        const evidenceInsight = buildEventInsights(
          mapEvidenceToTimeline(ensured.items),
          {
            dimension: resolvedInsightDimension,
            topN: 4,
            sequenceLength: 3,
            sequenceLengths: [3, 4],
            teamGroup: teamGroupForFacts,
            normalizeTeamActions: true,
          },
        );
        const facts = buildAiInsightFacts(
          evidenceInsight,
          ensured.items,
          resolvedInsightDimension,
          teamGroupForFacts,
          trimmedQuestion,
          timeline,
        );
        const { response, rawText, debug, usedFallback, fallbackSource } =
          await generateAiResponse({
            question: trimmedQuestion,
            evidence: ensured.items,
            filters: ensured.filters,
            facts: facts as Record<string, unknown>,
            config: {
              provider: 'llama.cpp',
              baseUrl: aiSettings.baseUrl,
              model: aiSettings.model,
              temperature,
              topP: LLM_TOP_P,
              topK: LLM_TOP_K,
              repeatPenalty: LLM_REPEAT_PENALTY,
            },
            options: {
              maxRetries: MAX_LLM_RETRIES,
              maxMemoChars: 90,
              maxEvidence: Math.max(1, evidenceTarget),
              requestId: runId,
              signal: controller.signal,
              onRetry: (info) => {
                setLlmAttempt(info.attempt);
                setLlmRetryInfo({
                  attempt: info.attempt,
                  total: info.maxRetries + 1,
                  mode: info.mode,
                  reason: info.reason,
                });
                setLlmLiveLog((prev) => {
                  const marker = `\n--- retry ${info.attempt}/${info.maxRetries + 1} (${info.mode}) ---\n`;
                  const next = `${prev}${marker}`;
                  return next.length <= 8000 ? next : next.slice(-8000);
                });
              },
            },
          });
        if (generationRunIdRef.current !== runId) return;
        setAiResponse(response);
        setLlmRawText(rawText);
        setLlmDebug(debug ?? null);
        if (usedFallback) {
          const reason =
            fallbackSource === 'heuristic'
              ? 'LLMのJSON生成に失敗したため、根拠上位から推定結果を作成しました。'
              : 'JSON解析が不完全だったため、出力を補正して表示しています。';
          setLlmWarning(reason);
        } else {
          setLlmWarning(null);
        }
        setGenerationStatus('done');
      } catch (error) {
        console.debug('[AI] generate failed', error);
        const message =
          error instanceof Error
            ? error.message
            : 'AI生成でエラーが発生しました。';
        const cancelled = message.includes('キャンセル');
        if (!cancelled) {
          setGenerationError(message);
          setGenerationStatus('error');
        } else {
          setGenerationError('生成をキャンセルしました。');
          setGenerationStatus('idle');
        }
      } finally {
        if (generationRunIdRef.current === runId) {
          generationRunIdRef.current = null;
          generationAbortRef.current = null;
          setGenerationRequestId(null);
          setLlmProgress(null);
        }
      }
    },
    [
      activeFilters,
      aiSettings.baseUrl,
      aiSettings.model,
      aiSettings.temperature,
      buildFilters,
      evidenceItems,
      evidenceTarget,
      ensureEvidence,
      insightData,
      question,
      resolvedInsightDimension,
      evidenceQuery,
    ],
  );

  const handleCancelGeneration = useCallback(async () => {
    if (generationStatus !== 'running') return;
    generationAbortRef.current?.abort();
    const requestId = generationRequestId ?? generationRunIdRef.current;
    if (requestId && globalThis.window?.electronAPI?.llama?.cancel) {
      await globalThis.window.electronAPI.llama.cancel(requestId);
    }
    generationRunIdRef.current = null;
    generationAbortRef.current = null;
    setGenerationRequestId(null);
    setLlmProgress(null);
    setLlmLiveLog('');
    setLlmAttempt(1);
    setLlmRetryInfo(null);
    setGenerationError('生成をキャンセルしました。');
    setGenerationStatus('idle');
  }, [generationRequestId, generationStatus]);

  const handleGenerateInsights = useCallback(async () => {
    setGenerationError(null);
    setPlaylistMessage(null);
    setGenerationStatus('running');
    setAiResponse(null);
    setLlmRawText(null);
    setLlmLiveLog('');
    setLlmAttempt(1);
    setLlmRetryInfo(null);
    setLlmDebug(null);
    setLlmWarning(null);

    const trimmedQuestion = question.trim();
    const effectiveQuestion = trimmedQuestion || AUTO_INSIGHT_QUESTION;
    const displayQuestion = trimmedQuestion || 'インサイト自動生成';
    const temperature = Number.isFinite(aiSettings.temperature)
      ? aiSettings.temperature
      : 0.2;
    const filters = buildFilters();

    if (insightEvidenceItems.length === 0) {
      setGenerationError('インサイト用の根拠が不足しています。');
      setGenerationStatus('error');
      return;
    }

    setLastQuestion(displayQuestion);
    setEvidenceItems(insightEvidenceItems);
    setActiveFilters(filters);
    setRetrievalStatus('done');

    const runId = crypto.randomUUID();
    generationRunIdRef.current = runId;
    setGenerationRequestId(runId);
    setLlmProgress({
      requestId: runId,
      phase: 'start',
      outputChars: 0,
      elapsedMs: 0,
    });
    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    const evidenceInsight = buildEventInsights(
      mapEvidenceToTimeline(insightEvidenceItems),
      {
        dimension: resolvedInsightDimension,
        topN: 4,
        sequenceLength: 3,
        sequenceLengths: [3, 4],
        teamGroup: teamGroupForFacts,
        normalizeTeamActions: true,
      },
    );
    const facts = buildAiInsightFacts(
      evidenceInsight,
      insightEvidenceItems,
      resolvedInsightDimension,
      teamGroupForFacts,
      effectiveQuestion,
      timeline,
    );

    try {
      const { response, rawText, debug, usedFallback, fallbackSource } =
        await generateAiResponse({
          question: effectiveQuestion,
          evidence: insightEvidenceItems,
          filters,
          facts: facts as Record<string, unknown>,
          config: {
            provider: 'llama.cpp',
            baseUrl: aiSettings.baseUrl,
            model: aiSettings.model,
            temperature,
            topP: LLM_TOP_P,
            topK: LLM_TOP_K,
            repeatPenalty: LLM_REPEAT_PENALTY,
          },
          options: {
            maxRetries: MAX_LLM_RETRIES,
            maxMemoChars: 90,
            maxEvidence: Math.max(1, evidenceTarget),
            requestId: runId,
            signal: controller.signal,
            onRetry: (info) => {
              setLlmAttempt(info.attempt);
              setLlmRetryInfo({
                attempt: info.attempt,
                total: info.maxRetries + 1,
                mode: info.mode,
                reason: info.reason,
              });
              setLlmLiveLog((prev) => {
                const marker = `\n--- retry ${info.attempt}/${info.maxRetries + 1} (${info.mode}) ---\n`;
                const next = `${prev}${marker}`;
                return next.length <= 8000 ? next : next.slice(-8000);
              });
            },
          },
        });
      if (generationRunIdRef.current !== runId) return;
      setAiResponse(response);
      setLlmRawText(rawText);
      setLlmDebug(debug ?? null);
      if (usedFallback) {
        const reason =
          fallbackSource === 'heuristic'
            ? 'LLMのJSON生成に失敗したため、インサイト根拠から推定結果を作成しました。'
            : 'JSON解析が不完全だったため、出力を補正して表示しています。';
        setLlmWarning(reason);
      } else {
        setLlmWarning(null);
      }
      setGenerationStatus('done');
    } catch (error) {
      console.debug('[AI] generate insights failed', error);
      const message =
        error instanceof Error
          ? error.message
          : 'AI生成でエラーが発生しました。';
      const cancelled = message.includes('キャンセル');
      if (!cancelled) {
        setGenerationError(message);
        setGenerationStatus('error');
      } else {
        setGenerationError('生成をキャンセルしました。');
        setGenerationStatus('idle');
      }
    } finally {
      if (generationRunIdRef.current === runId) {
        generationRunIdRef.current = null;
        generationAbortRef.current = null;
        setGenerationRequestId(null);
        setLlmProgress(null);
      }
    }
  }, [
    aiSettings.baseUrl,
    aiSettings.model,
    aiSettings.temperature,
    buildFilters,
    evidenceTarget,
    insightData,
    insightEvidenceItems,
    question,
    resolvedInsightDimension,
  ]);

  const evidenceMap = useMemo(() => {
    return new Map(evidenceItems.map((item) => [item.id, item]));
  }, [evidenceItems]);

  const validatedHighlights: AiEvidenceHighlight[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.evidenceHighlights
      .map((highlight) => ({
        ...highlight,
        id: normalizeEvidenceId(highlight.id),
      }))
      .filter((highlight) => highlight.id && evidenceMap.has(highlight.id));
  }, [aiResponse, evidenceMap]);

  const validatedHypotheses: AiHypothesis[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.hypotheses
      .map((hypothesis) => ({
        ...hypothesis,
        evidenceIds: hypothesis.evidenceIds
          .map((id) => normalizeEvidenceId(id))
          .filter((id) => id && evidenceMap.has(id))
          .slice(0, 5),
      }))
      .filter((hypothesis) => hypothesis.evidenceIds.length > 0);
  }, [aiResponse, evidenceMap]);

  const validatedClips: AiRecommendedClip[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.recommendedClips
      .map((clip) => ({
        ...clip,
        centerId: normalizeEvidenceId(clip.centerId),
        evidenceIds: clip.evidenceIds
          .map((id) => normalizeEvidenceId(id))
          .filter((id) => id && evidenceMap.has(id))
          .slice(0, 5),
      }))
      .filter(
        (clip) => evidenceMap.has(clip.centerId) && clip.evidenceIds.length > 0,
      );
  }, [aiResponse, evidenceMap]);

  const sequenceGroups = useMemo(() => {
    const groups: string[][] = [];
    insightData.topSequences.forEach((stat) => {
      if (stat.evidenceIds.length > 0) {
        groups.push(stat.evidenceIds);
      }
    });
    if (insightData.topSequencesByLength) {
      Object.values(insightData.topSequencesByLength).forEach((stats) => {
        stats.forEach((stat) => {
          if (stat.evidenceIds.length > 0) {
            groups.push(stat.evidenceIds);
          }
        });
      });
    }
    return groups;
  }, [insightData]);

  const groundedEvidence = useMemo(() => {
    const ids = new Set<string>();
    validatedHypotheses.forEach((item) => {
      item.evidenceIds.forEach((id) => ids.add(id));
    });
    validatedHighlights.forEach((item) => ids.add(item.id));
    validatedClips.forEach((clip) => {
      clip.evidenceIds.forEach((id) => ids.add(id));
      ids.add(clip.centerId);
    });
    return evidenceItems.filter((item) => ids.has(item.id));
  }, [evidenceItems, validatedHypotheses, validatedHighlights, validatedClips]);

  const hasGroundedOutput = useMemo(
    () =>
      validatedHighlights.length > 0 ||
      validatedHypotheses.length > 0 ||
      validatedClips.length > 0,
    [
      validatedClips.length,
      validatedHighlights.length,
      validatedHypotheses.length,
    ],
  );

  const clipSegments = useMemo(() => {
    return buildClipSegments(validatedClips, evidenceMap, {
      sequences: sequenceGroups,
    });
  }, [validatedClips, evidenceMap, sequenceGroups]);

  const displayQuestion = useMemo(() => {
    const trimmed = question.trim();
    if (lastQuestion) return lastQuestion;
    if (generationStatus === 'running') {
      return trimmed || 'インサイト自動生成';
    }
    return '';
  }, [generationStatus, lastQuestion, question]);

  const stripEvidenceIds = useCallback(
    (text: string, fallback = '（内容が不足しています）') => {
      if (!text) return fallback;
      let result = text;
      evidenceMap.forEach((_, id) => {
        if (id && result.includes(id)) {
          result = result.split(id).join('');
        }
      });
      const cleaned = result.replace(/\s{2,}/g, ' ').trim();
      return cleaned || fallback;
    },
    [evidenceMap],
  );

  const handleCreatePlaylist = useCallback(async () => {
    if (!onCreateAiPlaylist) {
      setPlaylistMessage('プレイリスト機能が利用できません。');
      return;
    }
    if (clipSegments.length === 0) {
      setPlaylistMessage('生成可能なクリップがありません。');
      return;
    }

    setPlaylistMessage('AIプレイリストを作成中...');
    const now = Date.now();
    const items: PlaylistItem[] = clipSegments.map((segment, index) => {
      const primaryCenterId = segment.centerIds[0];
      const center = primaryCenterId ? evidenceMap.get(primaryCenterId) : null;
      const actionName =
        segment.title || center?.actionName || `AI Clip ${index + 1}`;
      return {
        id: crypto.randomUUID(),
        timelineItemId: primaryCenterId ?? null,
        actionName,
        startTime: segment.startTime,
        endTime: segment.endTime,
        labels: center?.labels,
        memo: center?.memo,
        addedAt: now,
        aiMeta: {
          reason: segment.reason,
          centerId: primaryCenterId,
          centerIds: segment.centerIds,
          evidenceIds: segment.evidenceIds,
          source: 'ai-review',
        },
      };
    });

    try {
      await onCreateAiPlaylist({
        name: buildPlaylistName(),
        items,
      });
      setPlaylistMessage('AIプレイリストを作成しました。');
    } catch (error) {
      console.debug('[AI] playlist creation failed', error);
      setPlaylistMessage('AIプレイリストの作成に失敗しました。');
    }
  }, [clipSegments, evidenceMap, onCreateAiPlaylist]);

  if (!hasData || timeline.length === 0) {
    return <NoDataPlaceholder message={emptyMessage} />;
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
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  bgcolor: 'background.default',
                  p: 2,
                  minHeight: { xs: 200, md: 250 },
                  maxHeight: { xs: 300, md: 350 },
                  overflowY: 'auto',
                }}
              >
                <Stack spacing={2}>
                  {(displayQuestion ||
                    aiResponse ||
                    generationStatus === 'running') && (
                    <Box
                      sx={{
                        alignSelf: 'flex-end',
                        bgcolor: 'success.main',
                        color: 'success.contrastText',
                        px: 2,
                        py: 1.5,
                        borderRadius: 2,
                        maxWidth: { xs: '100%', md: '85%' },
                      }}
                    >
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        あなた
                      </Typography>
                      <Typography variant="body2">
                        {displayQuestion || '（インサイト自動生成）'}
                      </Typography>
                    </Box>
                  )}
                  <Box
                    sx={{
                      alignSelf: 'flex-start',
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      maxWidth: { xs: '100%', md: '90%' },
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Typography variant="caption" color="text.secondary">
                        AI
                      </Typography>
                      {generationStatus === 'running' && (
                        <Stack spacing={0.5}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <CircularProgress size={18} thickness={5} />
                            <Typography variant="body2">生成中...</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            試行 {llmAttempt}/{MAX_LLM_RETRIES + 1}
                            {llmRetryInfo
                              ? ` / 再試行: ${
                                  llmRetryInfo.mode === 'repair'
                                    ? 'JSON修復'
                                    : '情報圧縮'
                                }`
                              : ''}
                          </Typography>
                          {llmProgress && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              経過 {formatElapsed(llmProgress.elapsedMs)} / 出力{' '}
                              {llmProgress.outputChars ?? 0} 文字
                            </Typography>
                          )}
                        </Stack>
                      )}
                      {aiResponse && !hasGroundedOutput && (
                        <Alert severity="warning">
                          根拠に紐づく出力が不足しています。表示内容は参考程度に留めてください。
                        </Alert>
                      )}
                      {llmWarning && (
                        <Alert severity="warning">{llmWarning}</Alert>
                      )}
                      {!aiResponse && generationStatus !== 'running' && (
                        <Typography variant="body2" color="text.secondary">
                          まだAI出力がありません。
                        </Typography>
                      )}
                      {aiResponse && (
                        <>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            要約
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stripEvidenceIds(aiResponse.summary)}
                          </Typography>
                          <Divider />
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            因果仮説
                          </Typography>
                          {validatedHypotheses.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              根拠が不足しているため仮説は表示されません。
                            </Typography>
                          ) : (
                            <Stack spacing={1}>
                              {validatedHypotheses.map((hypothesis, index) => (
                                <Box key={`${hypothesis.text}-${index}`}>
                                  <Typography variant="body2">
                                    {stripEvidenceIds(hypothesis.text)}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    根拠: {hypothesis.evidenceIds.length}件
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          )}
                          <Divider />
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            重要イベント
                          </Typography>
                          {validatedHighlights.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              重要イベントの指摘はありません。
                            </Typography>
                          ) : (
                            <Stack spacing={1}>
                              {validatedHighlights.map((highlight) => {
                                const item = timelineMap.get(highlight.id);
                                return (
                                  <Box
                                    key={highlight.id}
                                    sx={{
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      p: 2,
                                      borderRadius: 2,
                                      cursor: item ? 'pointer' : 'default',
                                    }}
                                    onClick={() => {
                                      if (item) onJumpToSegment?.(item);
                                    }}
                                  >
                                    <Box
                                      display="flex"
                                      justifyContent="space-between"
                                      alignItems="center"
                                      gap={2}
                                    >
                                      <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 600 }}
                                      >
                                        {item?.actionName ?? highlight.id}
                                      </Typography>
                                      {item && (
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          onClick={() =>
                                            onJumpToSegment?.(item)
                                          }
                                        >
                                          映像へジャンプ
                                        </Button>
                                      )}
                                    </Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {item
                                        ? `${formatSeconds(item.startTime)} - ${formatSeconds(
                                            item.endTime,
                                          )}`
                                        : 'イベントを特定できません'}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      mt={1}
                                    >
                                      {stripEvidenceIds(highlight.why)}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        </>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>

              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  質問テンプレート
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {questionTemplates.map((template) => (
                    <Chip
                      key={template}
                      label={template}
                      size="small"
                      variant="outlined"
                      onClick={() => setQuestion(template)}
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  検索プリセット
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {RETRIEVER_PRESETS.map((preset) => (
                    <Chip
                      key={preset.value}
                      label={preset.label}
                      size="small"
                      color={
                        retrieverPreset === preset.value ? 'primary' : 'default'
                      }
                      variant={
                        retrieverPreset === preset.value ? 'filled' : 'outlined'
                      }
                      onClick={() =>
                        setAiSettings({
                          ...aiSettings,
                          retrieverPreset: preset.value,
                        })
                      }
                    />
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {RETRIEVER_PRESETS.find(
                    (preset) => preset.value === retrieverPreset,
                  )?.helper ?? ''}
                </Typography>
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 1.5,
                  bgcolor: 'background.paper',
                }}
              >
                <InputBase
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="質問を入力..."
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={2}
                  sx={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    px: 1,
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (
                        generationStatus !== 'running' &&
                        retrievalStatus !== 'running' &&
                        question.trim()
                      ) {
                        void handleGenerate();
                      }
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => handleGenerate()}
                  disabled={
                    generationStatus === 'running' ||
                    retrievalStatus === 'running' ||
                    !question.trim()
                  }
                  sx={{ borderRadius: 999, px: 2, minWidth: 60 }}
                  size="small"
                >
                  {generationStatus === 'running' ? '実行中...' : '実行'}
                </Button>
              </Paper>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: 11 }}
              >
                Enter で実行、Shift+Enter で改行
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleRetrieveEvidence}
                  disabled={
                    retrievalStatus === 'running' ||
                    generationStatus === 'running'
                  }
                >
                  {retrievalStatus === 'running' ? '検索中...' : '根拠だけ取得'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleGenerate({ reuseEvidence: true })}
                  disabled={
                    generationStatus === 'running' ||
                    retrievalStatus === 'running' ||
                    evidenceItems.length === 0
                  }
                >
                  {generationStatus === 'running'
                    ? '生成中...'
                    : 'この根拠で再生成'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleGenerateInsights}
                  disabled={generationStatus === 'running'}
                >
                  {generationStatus === 'running'
                    ? '生成中...'
                    : 'インサイト自動生成'}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowFilters((prev) => !prev)}
                >
                  {showFilters ? 'フィルタを閉じる' : 'フィルタを開く'}
                </Button>
                {generationStatus === 'running' && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleCancelGeneration}
                  >
                    生成をキャンセル
                  </Button>
                )}
                {evidenceItems.length > 0 && (
                  <Chip
                    label={`根拠 ${evidenceItems.length}件`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {(retrievalStatus === 'running' ||
                  generationStatus === 'running') && (
                  <CircularProgress size={18} thickness={5} />
                )}
              </Stack>
            </Stack>

            <Collapse in={showFilters}>
              <Stack spacing={2} mt={1}>
                <Typography variant="caption" color="text.secondary">
                  時間やラベルで絞り込みたい場合だけ設定してください。
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="開始秒（任意）"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="終了秒（任意）"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ flex: 1 }}
                  />
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel id="ai-label-group">ラベルgroup</InputLabel>
                    <Select
                      labelId="ai-label-group"
                      label="ラベルgroup"
                      value={labelGroup}
                      onChange={(event) => setLabelGroup(event.target.value)}
                    >
                      <MenuItem value="">すべて</MenuItem>
                      {availableGroups.map((group) => (
                        <MenuItem key={group} value={group}>
                          {group}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ flex: 1 }} disabled={!labelGroup}>
                    <InputLabel id="ai-label-name">ラベル名</InputLabel>
                    <Select
                      labelId="ai-label-name"
                      label="ラベル名"
                      value={labelName}
                      onChange={(event) => setLabelName(event.target.value)}
                    >
                      <MenuItem value="">すべて</MenuItem>
                      {availableLabels.map((label) => (
                        <MenuItem key={label} value={label}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                {effectiveTeamGroup && (
                  <FormControl sx={{ maxWidth: 260 }}>
                    <InputLabel id="ai-team-label">チーム</InputLabel>
                    <Select
                      labelId="ai-team-label"
                      label="チーム"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    >
                      <MenuItem value="">すべて</MenuItem>
                      {availableTeamLabels.map((label) => (
                        <MenuItem key={label} value={label}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </Collapse>

            {retrievalError && <Alert severity="error">{retrievalError}</Alert>}
            {generationError && (
              <Alert severity="error">{generationError}</Alert>
            )}

            {(llmRawText || llmDebug?.stderr || llmLiveLog) && (
              <>
                <Divider />
                <Box>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setShowDebug((prev) => !prev)}
                  >
                    {showDebug ? 'デバッグ情報を隠す' : 'デバッグ情報を表示'}
                  </Button>
                  {showDebug && (
                    <Stack spacing={2} mt={1}>
                      {llmRetryInfo && (
                        <Typography variant="caption" color="text.secondary">
                          再試行理由: {llmRetryInfo.reason}
                        </Typography>
                      )}
                      {llmLiveLog && (
                        <TextField
                          label="LLM live log"
                          value={llmLiveLog}
                          multiline
                          minRows={3}
                          fullWidth
                          InputProps={{ readOnly: true }}
                        />
                      )}
                      {llmRawText && (
                        <TextField
                          label="LLM raw output"
                          value={llmRawText}
                          multiline
                          minRows={4}
                          fullWidth
                          InputProps={{ readOnly: true }}
                        />
                      )}
                      {llmDebug?.stderr && (
                        <TextField
                          label="LLM stderr"
                          value={llmDebug.stderr}
                          multiline
                          minRows={3}
                          fullWidth
                          InputProps={{ readOnly: true }}
                        />
                      )}
                      {(llmDebug?.binaryPath ||
                        llmDebug?.modelPath ||
                        llmDebug?.durationMs != null) && (
                        <Stack spacing={0.5}>
                          {llmDebug?.binaryPath && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              binary: {llmDebug.binaryPath}
                            </Typography>
                          )}
                          {llmDebug?.modelPath && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              model: {llmDebug.modelPath}
                            </Typography>
                          )}
                          {llmDebug?.durationMs != null && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              duration: {llmDebug.durationMs} ms
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Box>
              </>
            )}
          </Stack>
        </AnalysisCard>

        <AnalysisCard title="クリップ">
          <Stack spacing={2}>
            <Button
              variant="contained"
              onClick={handleCreatePlaylist}
              disabled={
                !onCreateAiPlaylist ||
                clipSegments.length === 0 ||
                !hasGroundedOutput
              }
              size="small"
            >
              プレイリスト作成
            </Button>
            {playlistMessage && (
              <Alert severity="info">{playlistMessage}</Alert>
            )}
            {!aiResponse && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: 12 }}
              >
                結果がありません。
              </Typography>
            )}
            {aiResponse && clipSegments.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: 12 }}
              >
                クリップが見つかりませんでした。
              </Typography>
            ) : (
              <Stack spacing={1}>
                {validatedClips.map((clip, index) => (
                  <Box
                    key={`${clip.centerId}-${index}`}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 2,
                      borderRadius: 2,
                    }}
                  >
                    {(() => {
                      const center = evidenceMap.get(clip.centerId);
                      const centerLabel = center?.actionName ?? '中心イベント';
                      const centerTime = center
                        ? `${formatSeconds(center.startTime)} - ${formatSeconds(center.endTime)}`
                        : '';
                      return (
                        <>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {stripEvidenceIds(clip.title, 'AIクリップ')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {centerLabel}
                            {centerTime ? ` / ${centerTime}` : ''} / pre{' '}
                            {clip.preSeconds}s / post {clip.postSeconds}s
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mt={1}
                          >
                            理由: {stripEvidenceIds(clip.reason)}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </AnalysisCard>
      </Stack>
      <Stack
        spacing={2}
        sx={{
          overflowY: 'auto',
          maxHeight: { xs: 'none', lg: '100vh' },
        }}
      >
        <AnalysisCard title="根拠">
          <Stack spacing={2}>
            {groundedEvidence.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: 12 }}
              >
                根拠がありません。
              </Typography>
            ) : (
              groundedEvidence.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    p: 2,
                    borderRadius: 2,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {item.actionName}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onJumpToSegment?.(item)}
                      sx={{ fontSize: 10, py: 0.5 }}
                    >
                      映像へジャンプ
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {formatSeconds(item.startTime)} -{' '}
                    {formatSeconds(item.endTime)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                    {getLabelsFromTimelineData({
                      ...item,
                      labels: item.labels,
                    }).map((label, index) => (
                      <Chip
                        key={`${label.name}-${index}`}
                        label={
                          label.group
                            ? `${label.group}:${label.name}`
                            : label.name
                        }
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                  {item.memo && (
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      メモ: {item.memo}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </Stack>
        </AnalysisCard>

        <AnalysisCard title="イベントインサイト（統計）">
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              ユーザー定義のイベントだけを用いて傾向を抽出します。現在の時間/ラベル/チーム
              フィルタが適用されます。
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="insight-dimension">分析軸</InputLabel>
                <Select
                  labelId="insight-dimension"
                  label="分析軸"
                  value={insightDimension}
                  onChange={(event) => setInsightDimension(event.target.value)}
                >
                  {insightDimensionOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            {insightDimension === 'auto' && (
              <Typography variant="caption" color="text.secondary">
                自動選択: {resolvedInsightLabel}
              </Typography>
            )}
            {insightData.summary.totalEvents === 0 ? (
              <Alert severity="info">対象イベントがありません。</Alert>
            ) : (
              <>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  <Chip
                    size="small"
                    label={`対象 ${insightData.summary.totalEvents}件`}
                  />
                  <Chip
                    size="small"
                    label={`状態 ${insightData.summary.uniqueStates}種類`}
                  />
                  <Chip
                    size="small"
                    label={`スパン ${formatSeconds(insightData.summary.timeSpanSec)}`}
                  />
                  <Chip
                    size="small"
                    label={`テンポ ${insightData.summary.eventsPerMin.toFixed(2)}件/分`}
                  />
                  <Chip
                    size="small"
                    label={`平均時間 ${formatDurationShort(insightData.summary.avgDuration)}`}
                  />
                </Box>
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  主要イベント
                </Typography>
                {insightData.topStates.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    集計対象が不足しています。
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {insightData.topStates.map((stat, index) => (
                      <Box key={`${stat.state}-${index}`}>
                        <Typography variant="body2">
                          {stat.state}：{stat.count}件（
                          {formatPercent(stat.share)}） / 平均
                          {formatDurationShort(stat.avgDuration)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  よくある遷移
                </Typography>
                {insightData.topTransitions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    遷移を計算するにはイベントが2件以上必要です。
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {insightData.topTransitions.map((stat, index) => (
                      <Typography
                        key={`${stat.from}-${stat.to}-${index}`}
                        variant="body2"
                      >
                        {stat.from} → {stat.to}：{stat.count}回（
                        {formatPercent(stat.probability)}）/ 平均間隔
                        {formatGapShort(stat.avgGap)}
                      </Typography>
                    ))}
                  </Stack>
                )}
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  頻出シーケンス（長さ3）
                </Typography>
                {insightData.topSequences.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    シーケンスを計算するにはイベントが3件以上必要です。
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {insightData.topSequences.map((stat, index) => (
                      <Typography
                        key={`${stat.sequence.join('>')}-${index}`}
                        variant="body2"
                      >
                        {stat.sequence.join(' → ')}：{stat.count}回
                      </Typography>
                    ))}
                  </Stack>
                )}
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  特徴的イベント
                </Typography>
                <Stack spacing={1}>
                  {insightData.longestEvents.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      長時間イベントはありません。
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {insightData.longestEvents.map((event) => (
                        <Box
                          key={event.id}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            p: 1.5,
                            borderRadius: 2,
                          }}
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            gap={1}
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              {event.state}（{event.actionName}）
                            </Typography>
                            {timelineMap.has(event.id) && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  onJumpToSegment?.(timelineMap.get(event.id)!)
                                }
                              >
                                映像へジャンプ
                              </Button>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatSeconds(event.startTime)} -{' '}
                            {formatSeconds(event.endTime)} / 継続{' '}
                            {formatDurationShort(event.duration)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  {insightData.rareStates.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        出現頻度が低い状態:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                        {insightData.rareStates.map((stat) => (
                          <Chip
                            key={stat.state}
                            size="small"
                            label={`${stat.state} (${stat.count}件)`}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </AnalysisCard>

        <AnalysisCard title="AI設定">
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              ローカルLLMの接続先とディメンション定義を設定します。
            </Typography>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2" color="text.secondary">
                現在のモデル: {modelSummary}
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => setShowAiSettings((prev) => !prev)}
              >
                {showAiSettings ? '設定を閉じる' : '設定を開く'}
              </Button>
            </Box>
            <Collapse in={showAiSettings}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="モデルファイル"
                    value={aiSettings.model}
                    onChange={(event) =>
                      setAiSettings({
                        ...aiSettings,
                        model: event.target.value,
                      })
                    }
                    placeholder="auto / example.gguf"
                    helperText="auto にすると、検出された最大サイズのモデルを自動選択します。"
                    sx={{ flex: 1 }}
                  />
                </Stack>
                {modelsStatus === 'loading' && (
                  <Typography variant="body2" color="text.secondary">
                    モデル一覧を取得中...
                  </Typography>
                )}
                {availableModels.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label="auto (推奨)"
                      color={isAutoModel ? 'primary' : 'default'}
                      onClick={() =>
                        setAiSettings({
                          ...aiSettings,
                          model: 'auto',
                        })
                      }
                    />
                    {availableModels.map((model) => (
                      <Chip
                        key={model.path}
                        label={`${model.name} (${formatBytes(model.sizeBytes)})`}
                        color={
                          aiSettings.model === model.name
                            ? 'primary'
                            : 'default'
                        }
                        onClick={() =>
                          setAiSettings({
                            ...aiSettings,
                            model: model.name,
                          })
                        }
                      />
                    ))}
                  </Stack>
                )}
                {recommendedModel &&
                  !isAutoModel &&
                  aiSettings.model !== recommendedModel.name && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setAiSettings({
                          ...aiSettings,
                          model: recommendedModel.name,
                        })
                      }
                    >
                      推奨モデルに切り替え
                    </Button>
                  )}
                {modelsError && <Alert severity="warning">{modelsError}</Alert>}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Temperature"
                    value={aiSettings.temperature}
                    onChange={(event) =>
                      setAiSettings({
                        ...aiSettings,
                        temperature: Number(event.target.value),
                      })
                    }
                    type="number"
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Top K"
                    value={aiSettings.topK}
                    onChange={(event) =>
                      setAiSettings({
                        ...aiSettings,
                        topK: Number(event.target.value),
                      })
                    }
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    sx={{ flex: 1 }}
                  />
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel id="ai-team-group">チーム判定group</InputLabel>
                    <Select
                      labelId="ai-team-group"
                      label="チーム判定group"
                      value={aiSettings.teamLabelGroup ?? ''}
                      onChange={(event) =>
                        setAiSettings({
                          ...aiSettings,
                          teamLabelGroup: event.target.value,
                        })
                      }
                    >
                      <MenuItem value="">自動検出</MenuItem>
                      {availableGroups.map((group) => (
                        <MenuItem key={group} value={group}>
                          {group}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Button variant="outlined" onClick={handleSaveSettings}>
                  AI設定を保存
                </Button>
                {settingsMessage && (
                  <Alert severity="info">{settingsMessage}</Alert>
                )}
                <Typography variant="caption" color="text.secondary">
                  モデルは `public/llama/models` 配下に配置してください。
                </Typography>
              </Stack>
            </Collapse>
          </Stack>
        </AnalysisCard>
      </Stack>
    </Box>
  );
};
