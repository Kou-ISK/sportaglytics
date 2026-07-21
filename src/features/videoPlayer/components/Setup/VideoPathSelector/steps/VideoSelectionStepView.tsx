import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { AngleSelection } from '../types';
import type { VideoSelectionStepProps } from './VideoSelectionStep';
import { AngleSidebar } from './videoSelection/AngleSidebar';
import { ClipInspector } from './videoSelection/ClipInspector';
import { ClipSequencePanel } from './videoSelection/ClipSequencePanel';

type VideoSelectionStepViewProps = Omit<
  VideoSelectionStepProps,
  'onAddAngle' | 'onAddClip'
> & {
  selectedAngle: AngleSelection | undefined;
  selectedClipId: string;
  onSelectAngle: (angleId: string) => void;
  onSelectClip: (clipId: string) => void;
  onAddAngle: () => void;
  onAddClip: () => void;
};

export const VideoSelectionStepView: React.FC<VideoSelectionStepViewProps> = (
  props,
) => (
  <Stack spacing={1.5} sx={{ height: '100%', minHeight: 430 }}>
    <Box>
      <Typography variant="subtitle1" fontWeight={700}>
        Video Package Builder
      </Typography>
      <Typography variant="caption" color="text.secondary">
        アングルごとに映像を順番に並べ、空白時間で同期位置を合わせます。
      </Typography>
    </Box>

    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: '180px minmax(300px, 1fr)',
          lg: '190px minmax(340px, 1fr) 260px',
        },
        gridTemplateRows: { xs: 'auto', md: 'minmax(360px, 1fr) auto' },
        minHeight: 0,
        flex: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <AngleSidebar
        angles={props.angles}
        selectedAngleId={props.selectedAngle?.id ?? ''}
        onSelectAngle={props.onSelectAngle}
        onAddAngle={props.onAddAngle}
      />
      <ClipSequencePanel
        angle={props.selectedAngle}
        selectedClipId={props.selectedClipId}
        onSelectClip={props.onSelectClip}
        onSelectVideos={props.onSelectVideos}
        onAddClip={props.onAddClip}
        onReorderClip={props.onReorderClip}
        onMoveClip={props.onMoveClip}
      />
      <ClipInspector
        angles={props.angles}
        angle={props.selectedAngle}
        selectedClipId={props.selectedClipId}
        onSelectVideo={props.onSelectVideo}
        onRemoveAngle={props.onRemoveAngle}
        onUpdateAngleName={props.onUpdateAngleName}
        onRemoveClip={props.onRemoveClip}
        onUpdateClip={props.onUpdateClip}
      />
    </Box>
  </Stack>
);
