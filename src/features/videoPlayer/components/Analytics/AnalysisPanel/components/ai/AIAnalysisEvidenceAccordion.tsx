import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { getLabelsFromTimelineData } from '../../../../../../../utils/labelExtractors';
import type { AIAnalysisEvidenceAccordionProps } from './aiAnalysisInsightsSidebar.types';

export const AIAnalysisEvidenceAccordion = ({
  accordionSx,
  isOpen,
  onChange,
  groundedEvidence,
  visibleEvidenceItems,
  showAllEvidence,
  hiddenEvidenceCount,
  evidenceDefaultVisibleCount,
  onToggleShowAllEvidence,
  onJumpToSegment,
  formatSeconds,
}: AIAnalysisEvidenceAccordionProps) => {
  return (
    <Accordion
      disableGutters
      expanded={isOpen}
      onChange={(_event, expanded) => onChange(expanded)}
      sx={accordionSx}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            根拠
          </Typography>
          {groundedEvidence.length > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={`${groundedEvidence.length}件`}
            />
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {groundedEvidence.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
              根拠がありません。
            </Typography>
          ) : (
            visibleEvidenceItems.map((item) => (
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
                  {formatSeconds(item.startTime)} - {formatSeconds(item.endTime)}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                  {getLabelsFromTimelineData({
                    ...item,
                    labels: item.labels,
                  }).map((label, index) => (
                    <Chip
                      key={`${label.name}-${index}`}
                      label={label.group ? `${label.group}:${label.name}` : label.name}
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
          {groundedEvidence.length > evidenceDefaultVisibleCount && (
            <Box display="flex" justifyContent="center">
              <Button size="small" variant="text" onClick={onToggleShowAllEvidence}>
                {showAllEvidence
                  ? '上位表示に戻す'
                  : `すべて表示（+${hiddenEvidenceCount}件）`}
              </Button>
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
