import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import type {
  AiCopilotResponse,
  AiEvidenceHighlight,
  AiHypothesis,
} from '../../../../../analysis/ai';
import type { TimelineData } from '../../../../../../../types/timeline/core';

interface AIAnalysisConversationPanelProps {
  displayQuestion: string;
  aiResponse: AiCopilotResponse | null;
  generationStatus: 'idle' | 'running' | 'done' | 'error';
  llmAttempt: number;
  maxLlmRetries: number;
  llmRetryInfo: {
    attempt: number;
    total: number;
    mode: 'reduce' | 'repair';
    reason: string;
  } | null;
  llmProgress: {
    requestId: string;
    phase?: string;
    outputChars?: number;
    elapsedMs?: number;
  } | null;
  llmWarning: string | null;
  hasGroundedOutput: boolean;
  validatedHypotheses: AiHypothesis[];
  validatedHighlights: AiEvidenceHighlight[];
  timelineMap: Map<string, TimelineData>;
  stripEvidenceIds: (text: string, fallback?: string) => string;
  onJumpToSegment?: (segment: TimelineData) => void;
  formatSeconds: (value: number) => string;
  formatElapsed: (ms?: number) => string;
}

export const AIAnalysisConversationPanel = ({
  displayQuestion,
  aiResponse,
  generationStatus,
  llmAttempt,
  maxLlmRetries,
  llmRetryInfo,
  llmProgress,
  llmWarning,
  hasGroundedOutput,
  validatedHypotheses,
  validatedHighlights,
  timelineMap,
  stripEvidenceIds,
  onJumpToSegment,
  formatSeconds,
  formatElapsed,
}: AIAnalysisConversationPanelProps): React.JSX.Element => {
  const hasResult = Boolean(aiResponse) || generationStatus === 'running';
  return (
    <Box
      role="region"
      aria-label="AI分析結果"
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        pt: 1.5,
        maxHeight: hasResult ? 'min(520px, 60vh)' : undefined,
        overflowY: 'auto',
      }}
    >
      <Stack spacing={2}>
        {(displayQuestion || aiResponse || generationStatus === 'running') && (
          <Box
            sx={{
              borderLeft: 2,
              borderColor: 'divider',
              pl: 1.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              質問
            </Typography>
            <Typography variant="body2">
              {displayQuestion || '（インサイト自動生成）'}
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="caption" color="text.secondary">
              分析結果
            </Typography>
            {generationStatus === 'running' && (
              <Stack spacing={0.5}>
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={18} thickness={5} />
                  <Typography variant="body2">生成中...</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  試行 {llmAttempt}/{maxLlmRetries + 1}
                  {llmRetryInfo
                    ? ` / 再試行: ${
                        llmRetryInfo.mode === 'repair' ? 'JSON修復' : '情報圧縮'
                      }`
                    : ''}
                </Typography>
                {llmProgress && (
                  <Typography variant="caption" color="text.secondary">
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
            {llmWarning && <Alert severity="warning">{llmWarning}</Alert>}
            {!aiResponse && generationStatus !== 'running' && (
              <Typography variant="body2" color="text.secondary">
                質問を入力して実行すると、ここに分析結果を表示します。
              </Typography>
            )}
            {aiResponse && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  要約
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stripEvidenceIds(aiResponse.summary)}
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
                          {stripEvidenceIds(hypothesis.text)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          根拠: {hypothesis.evidenceIds.length}件
                        </Typography>
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
                            borderTop: 1,
                            borderColor: 'divider',
                            py: 1.5,
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onJumpToSegment?.(item);
                                }}
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
    </Box>
  );
};
