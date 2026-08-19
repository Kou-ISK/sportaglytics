import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  EventDetectionModelInfo,
  EventDetectionModelStatus,
  EventDetectionProgress,
  EventTimelineMapping,
  RugbyEventType,
} from '../../../../types/eventDetection/core';

export interface EventDetectionAngleOption {
  id: string;
  name: string;
  localClipCount: number;
}

export interface EventDetectionSummary {
  added: number;
  duplicates: number;
  lowConfidence: number;
  modelStatus: EventDetectionModelStatus;
}

export interface EventDetectionDialogViewProps {
  open: boolean;
  loadingModels: boolean;
  models: EventDetectionModelInfo[];
  selectedModelKey: string;
  angleOptions: EventDetectionAngleOption[];
  selectedAngleId: string;
  mappings: EventTimelineMapping[];
  progress: EventDetectionProgress | null;
  running: boolean;
  error: string | null;
  summary: EventDetectionSummary | null;
  onClose: () => void;
  onModelChange: (modelKey: string) => void;
  onAngleChange: (angleId: string) => void;
  onMappingChange: (
    eventType: RugbyEventType,
    updates: Partial<EventTimelineMapping>,
  ) => void;
  onRun: () => void;
  onCancel: () => void;
}

const EVENT_LABELS: Record<RugbyEventType, string> = {
  restart: 'リスタート',
  scrum: 'Scrum',
  lineout: 'Lineout',
  maul: 'Maul',
  goalKick: 'Goal Kick',
};

const modelKey = (model: EventDetectionModelInfo): string =>
  `${model.id}@${model.version}`;

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

export const EventDetectionDialogView = ({
  open,
  loadingModels,
  models,
  selectedModelKey,
  angleOptions,
  selectedAngleId,
  mappings,
  progress,
  running,
  error,
  summary,
  onClose,
  onModelChange,
  onAngleChange,
  onMappingChange,
  onRun,
  onCancel,
}: EventDetectionDialogViewProps) => {
  const selectedModel = models.find(
    (model) => modelKey(model) === selectedModelKey,
  );
  const canRun =
    !running &&
    Boolean(selectedModel) &&
    Boolean(selectedAngleId) &&
    mappings.some((mapping) => mapping.enabled);

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>自動イベント検出</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            ローカルモデルでイベント候補を検出し、通常のタイムラインへ直接追加します。追加後は手動で削除・範囲修正・ラベル付けできます。
          </Typography>

          {loadingModels ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : models.length === 0 ? (
            <Alert severity="info">
              現在、この環境には利用可能な自動イベント検出モデルがありません。
            </Alert>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <FormControl fullWidth size="small">
                  <InputLabel>検出モデル</InputLabel>
                  <Select
                    value={selectedModelKey}
                    label="検出モデル"
                    disabled={running}
                    onChange={(event) => onModelChange(event.target.value)}
                  >
                    {models.map((model) => (
                      <MenuItem key={modelKey(model)} value={modelKey(model)}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ minWidth: 0 }}
                        >
                          <Typography variant="body2" noWrap>
                            {model.displayName} / {model.version}
                          </Typography>
                          {model.status === 'experimental' && (
                            <Chip label="試験" size="small" color="warning" />
                          )}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>解析するアングル</InputLabel>
                  <Select
                    value={selectedAngleId}
                    label="解析するアングル"
                    disabled={running}
                    onChange={(event) => onAngleChange(event.target.value)}
                  >
                    {angleOptions.map((angle) => (
                      <MenuItem key={angle.id} value={angle.id}>
                        {angle.name}（{angle.localClipCount} clips）
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {selectedModel?.status === 'experimental' && (
                <Alert severity="warning">
                  <Typography variant="subtitle2" component="div" sx={{ mb: 0.5 }}>
                    試験的な自動検出機能
                  </Typography>
                  このモデルは現在評価中です。誤検出や見逃しが発生します。追加された候補を確認・修正してから分析に使用してください。
                </Alert>
              )}

              {selectedModel && (
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    p: 1.5,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    モデル評価
                  </Typography>
                  <Stack spacing={0.75}>
                    {selectedModel.events.map((eventType) => {
                      const metric = selectedModel.metrics[eventType];
                      if (!metric) return null;
                      return (
                        <Box
                          key={eventType}
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            alignItems: 'baseline',
                          }}
                        >
                          <Typography variant="body2" sx={{ minWidth: 88 }}>
                            {EVENT_LABELS[eventType]}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Recall {formatPercent(metric.recall)} / Precision{' '}
                            {formatPercent(metric.precision)} / 評価 {metric.evaluatedMatches}
                            試合 / 基準しきい値 {metric.confidenceThreshold.toFixed(2)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              <Stack spacing={1.25}>
                <Typography variant="subtitle2">検出して追加するイベント</Typography>
                {mappings.map((mapping) => (
                  <Box
                    key={mapping.eventType}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      p: 1.5,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: '150px minmax(160px, 1fr) 115px 110px 110px',
                      },
                      gap: 1.25,
                      alignItems: 'center',
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={mapping.enabled}
                          disabled={running}
                          onChange={(event) =>
                            onMappingChange(mapping.eventType, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      }
                      label={EVENT_LABELS[mapping.eventType]}
                    />
                    <TextField
                      size="small"
                      label="追加先タイムライン名"
                      value={mapping.actionName}
                      disabled={running || !mapping.enabled}
                      onChange={(event) =>
                        onMappingChange(mapping.eventType, {
                          actionName: event.target.value,
                        })
                      }
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="検出しきい値"
                      value={mapping.minConfidence}
                      disabled={running || !mapping.enabled}
                      slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                      onChange={(event) =>
                        onMappingChange(mapping.eventType, {
                          minConfidence: Number.parseFloat(event.target.value),
                        })
                      }
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="開始前（秒）"
                      value={mapping.leadTimeSeconds}
                      disabled={running || !mapping.enabled}
                      slotProps={{ htmlInput: { min: 0, max: 600, step: 1 } }}
                      onChange={(event) =>
                        onMappingChange(mapping.eventType, {
                          leadTimeSeconds: Number(event.target.value),
                        })
                      }
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="終了後（秒）"
                      value={mapping.lagTimeSeconds}
                      disabled={running || !mapping.enabled}
                      slotProps={{ htmlInput: { min: 0, max: 600, step: 1 } }}
                      onChange={(event) =>
                        onMappingChange(mapping.eventType, {
                          lagTimeSeconds: Number(event.target.value),
                        })
                      }
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ gridColumn: { xs: '1', sm: '2 / -1' } }}
                    >
                      検出しきい値は0.00〜1.00。低いほど見逃しが減る代わりに誤検出が増えます。
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {running && progress && (
            <Stack spacing={0.75}>
              <LinearProgress variant="determinate" value={progress.progress * 100} />
              <Typography variant="caption" color="text.secondary">
                {progress.message ??
                  (progress.stage === 'preparing'
                    ? '解析を準備しています'
                    : progress.stage === 'analyzing'
                      ? '映像を解析しています'
                      : '検出結果を確定しています')}
              </Typography>
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {summary && (
            <Alert severity="success">
              {summary.added}件をタイムラインに追加しました。
              {summary.duplicates > 0
                ? ` 重複 ${summary.duplicates}件は追加していません。`
                : ''}
              {summary.lowConfidence > 0
                ? ` 閾値未満 ${summary.lowConfidence}件は除外しました。`
                : ''}
              {summary.modelStatus === 'experimental'
                ? ' 試験モデルによる候補です。タイムラインを確認してください。'
                : ''}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {running ? (
          <Button onClick={onCancel}>キャンセル</Button>
        ) : (
          <Button onClick={onClose}>閉じる</Button>
        )}
        <Button variant="contained" disabled={!canRun} onClick={onRun}>
          検出してタイムラインへ追加
        </Button>
      </DialogActions>
    </Dialog>
  );
};
