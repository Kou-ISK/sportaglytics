import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  kickoff: 'Kickoff',
  scrum: 'Scrum',
  lineout: 'Lineout',
  maul: 'Maul',
  goalKick: 'Goal Kick',
};

const modelKey = (model: EventDetectionModelInfo): string =>
  `${model.id}@${model.version}`;

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
  const canRun =
    !running &&
    models.length > 0 &&
    Boolean(selectedModelKey) &&
    Boolean(selectedAngleId) &&
    mappings.some((mapping) => mapping.enabled);

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>自動イベント検出</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            検証済みのローカルモデルでイベントを検出し、通常のタイムラインへ直接追加します。追加後は手動で編集・ラベル付けできます。
          </Typography>

          {loadingModels ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : models.length === 0 ? (
            <Alert severity="info">
              現在、この環境には品質基準を満たした自動イベント検出モデルがありません。未検証モデルは使用できません。
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
                        {model.displayName} / {model.version}
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
                        sm: '180px minmax(180px, 1fr) 130px 130px',
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
                      label="開始前（秒）"
                      value={mapping.leadTimeSeconds}
                      disabled={running || !mapping.enabled}
                      slotProps={{ htmlInput: { min: 0, max: 600, step: 1 } }}
                      onChange={(event) =>
                        onMappingChange(mapping.eventType, {
                          leadTimeSeconds: Math.max(
                            0,
                            Math.min(600, Number(event.target.value) || 0),
                          ),
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
                          lagTimeSeconds: Math.max(
                            0,
                            Math.min(600, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ gridColumn: { xs: '1', sm: '2 / -1' } }}
                    >
                      検出confidenceは検証時の閾値 {Math.round(mapping.minConfidence * 100)}%
                      未満には下げません。
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
