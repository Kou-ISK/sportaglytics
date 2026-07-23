import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AngleSelection } from '../types';
import type { VideoSelectionStepProps } from './VideoSelectionStep';
import { AngleSidebar } from './videoSelection/AngleSidebar';
import { ClipSequencePanel } from './videoSelection/ClipSequencePanel';

type VideoSelectionStepViewProps = Omit<
  VideoSelectionStepProps,
  'onAddAngle'
> & {
  selectedAngle: AngleSelection | undefined;
  selectedClipId: string;
  onSelectAngle: (angleId: string) => void;
  onSelectClip: (clipId: string) => void;
  onAddAngle: () => void;
};

interface YoutubeEditorState {
  angleId?: string;
  clipId?: string;
  source: string;
}

export const VideoSelectionStepView: React.FC<VideoSelectionStepViewProps> = (
  props,
) => {
  const [youtubeEditor, setYoutubeEditor] = useState<YoutubeEditorState | null>(
    null,
  );
  const [youtubeSource, setYoutubeSource] = useState('');

  useEffect(() => {
    setYoutubeSource(youtubeEditor?.source ?? '');
  }, [youtubeEditor]);

  const closeYoutubeEditor = (): void => setYoutubeEditor(null);
  const saveYoutubeSource = (): void => {
    const source = youtubeSource.trim();
    if (!source) return;
    if (youtubeEditor?.angleId && youtubeEditor.clipId) {
      props.onUpdateClip(youtubeEditor.angleId, youtubeEditor.clipId, {
        sourceKind: 'youtube',
        source,
      });
    } else if (youtubeEditor?.angleId) {
      props.onAddYoutubeClip(youtubeEditor.angleId, source);
    }
    closeYoutubeEditor();
  };

  return (
    <Stack spacing={1.5} sx={{ height: '100%', minHeight: 430 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            映像を追加
          </Typography>
          <Typography variant="caption" color="text.secondary">
            まず映像を読み込みます。同期位置は必要な場合だけ後から調整できます。
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '210px minmax(360px, 1fr)' },
          gridTemplateRows: {
            xs: 'auto minmax(300px, 1fr)',
            md: 'minmax(390px, 1fr)',
          },
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
          angleCount={props.angles.length}
          selectedClipId={props.selectedClipId}
          onSelectClip={props.onSelectClip}
          onUpdateAngleName={props.onUpdateAngleName}
          onRemoveAngle={props.onRemoveAngle}
          onSelectVideo={props.onSelectVideo}
          onEditYoutube={(angleId, clipId, source) =>
            setYoutubeEditor({ angleId, clipId, source })
          }
          onRemoveClip={props.onRemoveClip}
          onAddLocal={() =>
            props.selectedAngle &&
            void props.onSelectVideos(props.selectedAngle.id)
          }
          onAddYoutube={() =>
            props.selectedAngle &&
            setYoutubeEditor({
              angleId: props.selectedAngle.id,
              source: '',
            })
          }
          onAddDroppedVideos={props.onAddDroppedVideos}
          onReorderClip={props.onReorderClip}
          onMoveClip={props.onMoveClip}
        />
      </Box>

      <Dialog
        open={youtubeEditor !== null}
        onClose={closeYoutubeEditor}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {youtubeEditor?.clipId ? 'YouTube URLを編集' : 'YouTube URLを追加'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="YouTube URL"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeSource}
            onChange={(event) => setYoutubeSource(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveYoutubeSource();
            }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeYoutubeEditor}>キャンセル</Button>
          <Button
            variant="contained"
            disabled={!youtubeSource.trim()}
            onClick={saveYoutubeSource}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
