import type { ReactElement } from 'react';
import { Box, Typography } from '@mui/material';
import type { TimelineProvenance } from '../../../../../../types/timeline/provenance';

export const TimelineProvenanceView = ({
  provenance,
}: {
  provenance?: TimelineProvenance;
}): ReactElement => {
  if (!provenance) {
    return (
      <Typography variant="caption" color="text.secondary">
        出所・人確認の記録なし
      </Typography>
    );
  }
  return (
    <Box component="details" sx={{ overflowWrap: 'anywhere' }}>
      <Typography component="summary" variant="caption">
        自動検出由来 · 人確認の記録なし
      </Typography>
      <Typography variant="caption" component="p">
        元候補の情報です。編集後の区間の正確さや、人による確認を示しません。
      </Typography>
      {provenance.hasUnknownSource && (
        <Typography variant="caption" component="p">
          由来の記録がない場面も結合されています。
        </Typography>
      )}
      {provenance.sources.map((source, index) => (
        <Typography key={index} component="p" variant="caption">
          {source.modelId} / {source.modelVersion} · {source.eventType}
          {' · '}元候補スコア {source.confidence}
          {' · '}元候補時刻 {source.anchorTime}秒
        </Typography>
      ))}
    </Box>
  );
};
