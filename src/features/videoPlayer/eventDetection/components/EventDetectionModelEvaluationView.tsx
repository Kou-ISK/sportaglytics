import { EVENT_DETECTION_EVENT_NAMES } from '../domain/eventDetectionMappings';
import { Alert, Box, Stack, Typography } from '@mui/material';
import type { JSX } from 'react';
import type { EventDetectionModelInfo } from '../../../../types/eventDetection/core';

export interface EventDetectionModelEvaluationViewProps {
  model: EventDetectionModelInfo;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export const EventDetectionModelEvaluationView = ({
  model,
}: EventDetectionModelEvaluationViewProps): JSX.Element => {
  const referenceOnly = model.evaluationBasis === 'reference-coding';
  return (
    <Stack spacing={1.5}>
      {model.status === 'experimental' && (
        <Alert severity="warning">
          <Typography variant="subtitle2" component="div" sx={{ mb: 0.5 }}>
            試験的な自動検出機能
          </Typography>
          {referenceOnly
            ? '下の数値は既存Codingとの比較です。Codingと一致しない候補にも実際のプレーが含まれるため、実際の検出精度を示すものではありません。'
            : 'このモデルは現在評価中です。誤検出や見逃しが発生します。'}
          追加された候補を確認・修正してから分析に使用してください。
        </Alert>
      )}
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          p: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {referenceOnly ? '既存Codingとの比較' : 'モデル評価'}
        </Typography>
        <Stack spacing={0.75}>
          {model.events.map((eventType) => {
            const metric = model.metrics[eventType];
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
                  {EVENT_DETECTION_EVENT_NAMES[eventType]}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {referenceOnly
                    ? `記録済みプレーの再検出 ${percent(metric.recall)} / Codingと一致した候補 ${percent(metric.precision)} / 比較 ${metric.evaluatedMatches}試合`
                    : `Recall ${percent(metric.recall)} / Precision ${percent(metric.precision)} / 評価 ${metric.evaluatedMatches}試合`}
                  {' / '}基準しきい値 {metric.confidenceThreshold.toFixed(2)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
};
