import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { AIAnalysisInsightAccordionProps } from './aiAnalysisInsightsSidebar.types';

export const AIAnalysisInsightAccordion = ({
  accordionSx,
  isOpen,
  onChange,
  insightDimension,
  onInsightDimensionChange,
  insightDimensionOptions,
  resolvedInsightLabel,
  insightData,
  timelineMap,
  onJumpToSegment,
  formatSeconds,
  formatPercent,
  formatDurationShort,
  formatGapShort,
}: AIAnalysisInsightAccordionProps) => {
  return (
    <Accordion
      disableGutters
      expanded={isOpen}
      onChange={(_event, expanded) => onChange(expanded)}
      sx={accordionSx}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          イベントインサイト（統計）
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
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
                onChange={(event) => onInsightDimensionChange(event.target.value)}
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
                <Chip size="small" label={`対象 ${insightData.summary.totalEvents}件`} />
                <Chip size="small" label={`状態 ${insightData.summary.uniqueStates}種類`} />
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
                        {stat.state}：{stat.count}件（{formatPercent(stat.share)}） / 平均
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
                    <Typography key={`${stat.from}-${stat.to}-${index}`} variant="body2">
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
                    <Typography key={`${stat.sequence.join('>')}-${index}`} variant="body2">
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
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {event.state}（{event.actionName}）
                          </Typography>
                          {timelineMap.has(event.id) && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onJumpToSegment?.(timelineMap.get(event.id)!)}
                            >
                              映像へジャンプ
                            </Button>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatSeconds(event.startTime)} - {formatSeconds(event.endTime)} /
                          継続 {formatDurationShort(event.duration)}
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
      </AccordionDetails>
    </Accordion>
  );
};
