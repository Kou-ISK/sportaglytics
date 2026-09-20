import type { JSX } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { EventDetectionPanelViewProps } from './EventDetectionPanelView';
import { EVENT_DETECTION_EVENT_NAMES } from '../domain/eventDetectionMappings';

export const EventDetectionMappingsView = ({
  mappings,
  running,
  onMappingChange,
}: Pick<
  EventDetectionPanelViewProps,
  'mappings' | 'running' | 'onMappingChange'
>): JSX.Element => (
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
            sm: 'repeat(3, minmax(0, 1fr))',
            md: '130px minmax(140px, 1fr) repeat(3, minmax(95px, 0.6fr))',
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
          label={EVENT_DETECTION_EVENT_NAMES[mapping.eventType]}
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
          sx={{ gridColumn: '1 / -1' }}
        >
          検出しきい値は0.00〜1.00。低いほど見逃しが減る代わりに誤検出が増えます。
        </Typography>
      </Box>
    ))}
  </Stack>
);
