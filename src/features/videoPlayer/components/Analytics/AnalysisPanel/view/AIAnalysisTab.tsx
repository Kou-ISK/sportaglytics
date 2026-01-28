import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
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
  type AiCopilotResponse,
  type AiEvidenceHighlight,
  type AiHypothesis,
  type AiRecommendedClip,
} from '../../../../analysis/ai';
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

const parseNumberInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPlaylistName = () => {
  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `AI Review: ${timestamp}`;
};

export const AIAnalysisTab = ({
  hasData,
  timeline,
  emptyMessage,
  onCreateAiPlaylist,
  onJumpToSegment,
}: AIAnalysisTabProps) => {
  const { settings, saveSettings } = useSettings();
  const defaultAiSettings =
    settings.aiAnalysis ?? DEFAULT_SETTINGS.aiAnalysis ?? {
      provider: 'llama.cpp',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.gguf',
      temperature: 0.2,
      topK: 40,
      embeddingEnabled: false,
      teamLabelGroup: '',
    };

  const [aiSettings, setAiSettings] = useState(defaultAiSettings);
  const [question, setQuestion] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [labelGroup, setLabelGroup] = useState('');
  const [labelName, setLabelName] = useState('');
  const [teamName, setTeamName] = useState('');

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
  const [activeFilters, setActiveFilters] = useState<EvidenceFilters | null>(
    null,
  );
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [playlistMessage, setPlaylistMessage] = useState<string | null>(null);

  useEffect(() => {
    setAiSettings(defaultAiSettings);
  }, [defaultAiSettings]);

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

  const effectiveTeamGroup = useMemo(() => {
    if (aiSettings.teamLabelGroup) return aiSettings.teamLabelGroup;
    const detected = availableGroups.find(
      (group) => group.toLowerCase() === 'team',
    );
    return detected ?? '';
  }, [aiSettings.teamLabelGroup, availableGroups]);

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

  const handleRetrieveEvidence = useCallback(async () => {
    setRetrievalError(null);
    setGenerationError(null);
    setPlaylistMessage(null);
    setRetrievalStatus('running');
    setAiResponse(null);
    setEvidenceItems([]);
    setActiveFilters(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setRetrievalError('質問を入力してください。');
      setRetrievalStatus('error');
      return;
    }

    const filters = buildFilters();
    const topK = Math.max(1, aiSettings.topK || 40);

    try {
      const items = retriever.retrieve(trimmedQuestion, evidenceIndex, {
        topK,
        timeRange: filters.timeRange,
        labelFilters: filters.labelFilters,
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
  }, [aiSettings.topK, buildFilters, evidenceIndex, question, retriever]);

  const ensureEvidence = useCallback(async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      throw new Error('質問を入力してください。');
    }
    const filters = buildFilters();
    const topK = Math.max(1, aiSettings.topK || 40);
    const items = retriever.retrieve(trimmedQuestion, evidenceIndex, {
      topK,
      timeRange: filters.timeRange,
      labelFilters: filters.labelFilters,
    });
    setEvidenceItems(items);
    setActiveFilters(filters);
    setRetrievalStatus('done');
    if (items.length === 0) {
      setRetrievalError('該当する根拠が見つかりませんでした。');
      throw new Error('該当する根拠が見つかりませんでした。');
    }
    return { items, filters };
  }, [
    aiSettings.topK,
    buildFilters,
    evidenceIndex,
    question,
    retriever,
  ]);

  const handleGenerate = useCallback(async () => {
    setGenerationError(null);
    setPlaylistMessage(null);
    setGenerationStatus('running');
    setAiResponse(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setGenerationError('質問を入力してください。');
      setGenerationStatus('error');
      return;
    }

    const temperature = Number.isFinite(aiSettings.temperature)
      ? aiSettings.temperature
      : 0.2;

    try {
      const ensured =
        evidenceItems.length > 0
          ? { items: evidenceItems, filters: activeFilters ?? buildFilters() }
          : await ensureEvidence();
      const { response } = await generateAiResponse({
        question: trimmedQuestion,
        evidence: ensured.items,
        filters: ensured.filters,
        config: {
          provider: 'llama.cpp',
          baseUrl: aiSettings.baseUrl,
          model: aiSettings.model,
          temperature,
        },
        options: {
          maxRetries: 2,
          maxMemoChars: 120,
          maxEvidence: Math.max(1, aiSettings.topK || 40),
        },
      });
      setAiResponse(response);
      setGenerationStatus('done');
    } catch (error) {
      console.debug('[AI] generate failed', error);
      setGenerationError(
        error instanceof Error
          ? error.message
          : 'AI生成でエラーが発生しました。',
      );
      setGenerationStatus('error');
    }
  }, [
    aiSettings.baseUrl,
    aiSettings.model,
    aiSettings.provider,
    aiSettings.temperature,
    activeFilters,
    buildFilters,
    evidenceItems,
    ensureEvidence,
    question,
  ]);

  const evidenceMap = useMemo(() => {
    return new Map(evidenceItems.map((item) => [item.id, item]));
  }, [evidenceItems]);

  const validatedHighlights: AiEvidenceHighlight[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.evidenceHighlights.filter((highlight) =>
      evidenceMap.has(highlight.id),
    );
  }, [aiResponse, evidenceMap]);

  const validatedHypotheses: AiHypothesis[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.hypotheses
      .map((hypothesis) => ({
        ...hypothesis,
        evidenceIds: hypothesis.evidenceIds.filter((id) =>
          evidenceMap.has(id),
        ),
      }))
      .filter((hypothesis) => hypothesis.evidenceIds.length > 0);
  }, [aiResponse, evidenceMap]);

  const validatedClips: AiRecommendedClip[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.recommendedClips
      .map((clip) => ({
        ...clip,
        evidenceIds: clip.evidenceIds.filter((id) => evidenceMap.has(id)),
      }))
      .filter(
        (clip) => evidenceMap.has(clip.centerId) && clip.evidenceIds.length > 0,
      );
  }, [aiResponse, evidenceMap]);

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
    [validatedClips.length, validatedHighlights.length, validatedHypotheses.length],
  );

  const clipSegments = useMemo(() => {
    return buildClipSegments(validatedClips, evidenceMap);
  }, [validatedClips, evidenceMap]);

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
    <Stack spacing={2}>
      <AnalysisCard title="AIレビュー・コパイロット">
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            質問に対して根拠を抽出し、仮説と関連クリップを提案します。外部ネットワーク通信は行いません。
          </Typography>
          <TextField
            label="質問"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例: 後半の攻撃が停滞した要因は？"
            fullWidth
            multiline
            minRows={2}
          />
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

          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Button
              variant="contained"
              onClick={handleRetrieveEvidence}
              disabled={retrievalStatus === 'running'}
            >
              {retrievalStatus === 'running' ? '検索中...' : '根拠を検索'}
            </Button>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={
                generationStatus === 'running'
              }
            >
              {generationStatus === 'running'
                ? '生成中...'
                : 'AIレビューを生成'}
            </Button>
            {(retrievalStatus === 'running' ||
              generationStatus === 'running') && (
              <CircularProgress size={20} thickness={5} />
            )}
          </Box>

          {retrievalError && <Alert severity="error">{retrievalError}</Alert>}
          {generationError && <Alert severity="error">{generationError}</Alert>}
        </Stack>
      </AnalysisCard>

      <AnalysisCard title="検索された根拠">
        <Stack spacing={2}>
          {retrievalStatus === 'idle' && (
            <Typography variant="body2" color="text.secondary">
              質問とフィルタを指定して「根拠を検索」または「AIレビューを生成」を押してください。
            </Typography>
          )}
          {retrievalStatus !== 'idle' && evidenceItems.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              該当する根拠がありません。
            </Typography>
          )}
          {evidenceItems.map((item) => (
            <Box
              key={item.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                p: 2,
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {item.actionName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatSeconds(item.startTime)} - {formatSeconds(item.endTime)} /
                ID: {item.id}
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
          ))}
        </Stack>
      </AnalysisCard>

      <AnalysisCard title="AI設定">
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            ローカルLLMの接続先とディメンション定義を設定します。
          </Typography>
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
              placeholder="example.gguf"
              sx={{ flex: 1 }}
            />
          </Stack>
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
      </AnalysisCard>

      <AnalysisCard title="AI出力">
        <Stack spacing={2}>
          {!aiResponse && (
            <Typography variant="body2" color="text.secondary">
              まだAI出力がありません。
            </Typography>
          )}
          {aiResponse && !hasGroundedOutput && (
            <Alert severity="warning">
              根拠に紐づく出力が得られませんでした。
            </Alert>
          )}
          {aiResponse && hasGroundedOutput && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                要約
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {aiResponse.summary}
              </Typography>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
                        {hypothesis.text}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                        {hypothesis.evidenceIds.map((id) => (
                          <Chip key={id} label={`根拠:${id}`} size="small" />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
                        }}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={2}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {item?.actionName ?? highlight.id}
                          </Typography>
                          {item && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onJumpToSegment?.(item)}
                            >
                              映像へジャンプ
                            </Button>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {item
                            ? `${formatSeconds(item.startTime)} - ${formatSeconds(
                                item.endTime,
                              )}`
                            : `ID: ${highlight.id}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          {highlight.why}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </AnalysisCard>

      <AnalysisCard title="引用された根拠">
        <Stack spacing={2}>
          {groundedEvidence.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              引用された根拠がありません。
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
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {item.actionName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatSeconds(item.startTime)} - {formatSeconds(item.endTime)} /
                  ID: {item.id}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                  {getLabelsFromTimelineData({
                    ...item,
                    labels: item.labels,
                  }).map((label, index) => (
                    <Chip
                      key={`${label.name}-${index}`}
                      label={
                        label.group ? `${label.group}:${label.name}` : label.name
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

      <AnalysisCard title="おすすめクリップ">
        <Stack spacing={2}>
          <Button
            variant="contained"
            onClick={handleCreatePlaylist}
            disabled={
              !onCreateAiPlaylist ||
              clipSegments.length === 0 ||
              !hasGroundedOutput
            }
          >
            この根拠からプレイリスト生成
          </Button>
          {playlistMessage && (
            <Alert severity="info">{playlistMessage}</Alert>
          )}
          {!aiResponse && (
            <Typography variant="body2" color="text.secondary">
              まだ生成結果がありません。
            </Typography>
          )}
          {aiResponse && clipSegments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              生成可能なクリップがありません。
            </Typography>
          ) : (
            <Stack spacing={1}>
              {validatedClips.map((clip, index) => (
                <Box
                  key={`${clip.centerId}-${index}`}
                  sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {clip.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    center: {clip.centerId} / pre {clip.preSeconds}s / post {clip.postSeconds}s
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    理由: {clip.reason}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                    {clip.evidenceIds.map((id) => (
                      <Chip key={id} label={`根拠:${id}`} size="small" />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </AnalysisCard>
    </Stack>
  );
};
