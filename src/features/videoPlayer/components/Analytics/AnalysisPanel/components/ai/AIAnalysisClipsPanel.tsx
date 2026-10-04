import React from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  AiRecommendedClip,
  EvidenceItem,
} from '../../../../../analysis/ai';

interface AIAnalysisClipsPanelProps {
  onCreateAiPlaylist?: () => void;
  playlistMessage: string | null;
  hasGroundedOutput: boolean;
  aiResponseExists: boolean;
  clipSegmentsCount: number;
  validatedClips: AiRecommendedClip[];
  evidenceMap: Map<string, EvidenceItem>;
  stripEvidenceIds: (text: string, fallback?: string) => string;
  formatSeconds: (value: number) => string;
}

export const AIAnalysisClipsPanel = ({
  onCreateAiPlaylist,
  playlistMessage,
  hasGroundedOutput,
  aiResponseExists,
  clipSegmentsCount,
  validatedClips,
  evidenceMap,
  stripEvidenceIds,
  formatSeconds,
}: AIAnalysisClipsPanelProps): React.JSX.Element => {
  return (
    <Stack spacing={1.5}>
      <Button
        variant="contained"
        onClick={onCreateAiPlaylist}
        disabled={
          !onCreateAiPlaylist || clipSegmentsCount === 0 || !hasGroundedOutput
        }
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        プレイリスト作成
      </Button>
      {playlistMessage && <Alert severity="info">{playlistMessage}</Alert>}
      {!aiResponseExists && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: 12 }}
        >
          分析結果のクリップ候補から作成できます。
        </Typography>
      )}
      {aiResponseExists && clipSegmentsCount === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: 12 }}
        >
          クリップが見つかりませんでした。
        </Typography>
      ) : (
        <Stack spacing={1}>
          {validatedClips.map((clip, index) => {
            const center = evidenceMap.get(clip.centerId);
            const centerLabel = center?.actionName ?? '中心イベント';
            const centerTime = center
              ? `${formatSeconds(center.startTime)} - ${formatSeconds(center.endTime)}`
              : '';
            return (
              <Box
                key={`${clip.centerId}-${index}`}
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  py: 1.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {stripEvidenceIds(clip.title, 'AIクリップ')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {centerLabel}
                  {centerTime ? ` / ${centerTime}` : ''} / pre {clip.preSeconds}
                  s / post {clip.postSeconds}s
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  理由: {stripEvidenceIds(clip.reason)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};
