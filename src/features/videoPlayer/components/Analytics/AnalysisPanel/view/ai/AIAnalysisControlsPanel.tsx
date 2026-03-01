import React from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  InputBase,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AIAnalysisDebugPanel } from './AIAnalysisDebugPanel';

interface RetrieverPresetOption {
  value: 'balanced' | 'labels' | 'memo' | 'time';
  label: string;
  helper: string;
}

interface LlmRetryInfo {
  attempt: number;
  total: number;
  mode: 'reduce' | 'repair';
  reason: string;
}

interface LlmDebugInfo {
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

interface AIAnalysisControlsPanelProps {
  questionTemplates: string[];
  question: string;
  setQuestion: (value: string) => void;
  retrieverPreset: 'balanced' | 'labels' | 'memo' | 'time';
  retrieverPresets: RetrieverPresetOption[];
  onRetrieverPresetChange: (
    value: 'balanced' | 'labels' | 'memo' | 'time',
  ) => void;
  generationStatus: 'idle' | 'running' | 'done' | 'error';
  retrievalStatus: 'idle' | 'running' | 'done' | 'error';
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

export const AIAnalysisControlsPanel = ({
  questionTemplates,
  question,
  setQuestion,
  retrieverPreset,
  retrieverPresets,
  onRetrieverPresetChange,
  generationStatus,
  retrievalStatus,
  handleRetrieveEvidence,
  handleGenerate,
  handleGenerateInsights,
  handleCancelGeneration,
  evidenceItemsCount,
  showFilters,
  setShowFilters,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  labelGroup,
  setLabelGroup,
  labelName,
  setLabelName,
  availableGroups,
  availableLabels,
  effectiveTeamGroup,
  teamName,
  setTeamName,
  availableTeamLabels,
  retrievalError,
  generationError,
  llmRawText,
  llmLiveLog,
  llmRetryInfo,
  llmDebug,
  showDebug,
  setShowDebug,
}: AIAnalysisControlsPanelProps) => {
  return (
    <>
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
          {retrieverPresets.map((preset) => (
            <Chip
              key={preset.value}
              label={preset.label}
              size="small"
              color={retrieverPreset === preset.value ? 'primary' : 'default'}
              variant={retrieverPreset === preset.value ? 'filled' : 'outlined'}
              onClick={() => onRetrieverPresetChange(preset.value)}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {retrieverPresets.find((preset) => preset.value === retrieverPreset)?.helper ?? ''}
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
          onClick={() => void handleGenerate()}
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
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
        Enter で実行、Shift+Enter で改行
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          size="small"
          variant="outlined"
          onClick={() => void handleRetrieveEvidence()}
          disabled={retrievalStatus === 'running' || generationStatus === 'running'}
        >
          {retrievalStatus === 'running' ? '検索中...' : '根拠だけ取得'}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => void handleGenerate({ reuseEvidence: true })}
          disabled={
            generationStatus === 'running' ||
            retrievalStatus === 'running' ||
            evidenceItemsCount === 0
          }
        >
          {generationStatus === 'running' ? '生成中...' : 'この根拠で再生成'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void handleGenerateInsights()}
          disabled={generationStatus === 'running'}
        >
          {generationStatus === 'running' ? '生成中...' : 'インサイト自動生成'}
        </Button>
        <Button
          size="small"
          variant="text"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'フィルタを閉じる' : 'フィルタを開く'}
        </Button>
        {generationStatus === 'running' && (
          <Button size="small" variant="text" onClick={() => void handleCancelGeneration()}>
            生成をキャンセル
          </Button>
        )}
        {evidenceItemsCount > 0 && (
          <Chip label={`根拠 ${evidenceItemsCount}件`} size="small" variant="outlined" />
        )}
        {(retrievalStatus === 'running' || generationStatus === 'running') && (
          <CircularProgress size={18} thickness={5} />
        )}
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
      {generationError && <Alert severity="error">{generationError}</Alert>}

      <AIAnalysisDebugPanel
        llmRawText={llmRawText}
        llmLiveLog={llmLiveLog}
        llmRetryInfo={llmRetryInfo}
        llmDebug={llmDebug}
        showDebug={showDebug}
        setShowDebug={setShowDebug}
      />
    </>
  );
};
