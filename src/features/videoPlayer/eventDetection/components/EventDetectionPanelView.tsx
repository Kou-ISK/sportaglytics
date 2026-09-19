import type { JSX } from 'react';
import { EventDetectionMappingsView } from './EventDetectionMappingsView';
import { EventDetectionModelEvaluationView } from './EventDetectionModelEvaluationView';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type {
  EventDetectionModelInfo,
  EventTimelineMapping,
  RugbyEventType,
} from '../../../../types/eventDetection/core';

import type { EventDetectionWindowState } from '../../../../types/ipc/eventDetectionWindow';
export type EventDetectionAngleOption =
  EventDetectionWindowState['angleOptions'][number];
export type EventDetectionSummary = NonNullable<
  EventDetectionWindowState['summary']
>;
export interface EventDetectionPanelViewProps extends EventDetectionWindowState {
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

const modelKey = (model: EventDetectionModelInfo): string =>
  `${model.id}@${model.version}`;

export const EventDetectionPanelView = ({
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
}: EventDetectionPanelViewProps): JSX.Element | null => {
  if (!open) return null;
  const selectedModel = models.find(
    (model) => modelKey(model) === selectedModelKey,
  );
  const canRun =
    !running &&
    Boolean(selectedModel) &&
    Boolean(selectedAngleId) &&
    mappings.some((mapping) => mapping.enabled);

  return (
    <Box
      component="main"
      aria-label="自動イベント検出"
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography component="h1" variant="h6">
          自動イベント検出
        </Typography>
        <Typography variant="body2" color="text.secondary">
          解析中も映像やタイムラインを操作できます。
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2 }}>
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
                  <InputLabel id="detection-model-label">検出モデル</InputLabel>
                  <Select
                    labelId="detection-model-label"
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
                  <InputLabel id="detection-angle-label">
                    解析するアングル
                  </InputLabel>
                  <Select
                    labelId="detection-angle-label"
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

              {selectedModel && (
                <Box component="details">
                  <Typography
                    component="summary"
                    variant="body2"
                    sx={{ cursor: 'pointer', mb: 1 }}
                  >
                    モデルの評価・注意点
                  </Typography>
                  <EventDetectionModelEvaluationView model={selectedModel} />
                </Box>
              )}

              <EventDetectionMappingsView
                mappings={mappings}
                running={running}
                onMappingChange={onMappingChange}
              />
            </>
          )}
        </Stack>
      </Box>
      <Stack
        spacing={1}
        sx={{ px: 3, flexShrink: 0, maxHeight: '30vh', overflowY: 'auto' }}
      >
        {running && progress && (
          <Stack spacing={0.75}>
            <LinearProgress
              aria-label="解析の進捗"
              variant="determinate"
              value={progress.progress * 100}
            />
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
      <Stack
        direction="row"
        spacing={1}
        sx={{
          px: 3,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        {running && <Button onClick={onClose}>バックグラウンドで続行</Button>}
        {running ? (
          <Button onClick={onCancel}>キャンセル</Button>
        ) : (
          <Button onClick={onClose}>閉じる</Button>
        )}
        <Button variant="contained" disabled={!canRun} onClick={onRun}>
          検出してタイムラインへ追加
        </Button>
      </Stack>
    </Box>
  );
};
