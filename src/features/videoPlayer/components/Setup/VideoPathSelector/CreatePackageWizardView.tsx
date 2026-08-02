import React from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { VideoSelectionStep } from './steps/VideoSelectionStep';
import { WizardFooter } from './WizardFooter';
import type { WizardFormState, WizardSelectionState } from './types';

interface CreatePackageWizardViewProps {
  open: boolean;
  activeStep: number;
  form: WizardFormState;
  errors: Partial<WizardFormState>;
  isCreating: boolean;
  selection: WizardSelectionState;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onFormChange: (updates: Partial<WizardFormState>) => void;
  onSelectVideo: (angleId: string, clipId: string) => Promise<void>;
  onSelectVideos: (angleId: string) => Promise<void>;
  onSelectVideosAsAngles: () => Promise<void>;
  onAddYoutubeClip: (angleId: string, source: string) => void;
  onAddDroppedVideos: (angleId: string, paths: string[]) => void;
  onAddAngle: () => void;
  onRemoveAngle: (angleId: string) => void;
  onUpdateAngleName: (angleId: string, name: string) => void;
  onRemoveClip: (angleId: string, clipId: string) => void;
  onUpdateClip: (
    angleId: string,
    clipId: string,
    updates: Partial<{
      sourceKind: 'local' | 'youtube';
      source: string;
      gapBeforeSeconds: number;
    }>,
  ) => void;
  onReorderClip: (
    angleId: string,
    activeClipId: string,
    overClipId: string,
  ) => void;
  onMoveClip: (angleId: string, clipId: string, direction: -1 | 1) => void;
}

const STEP_LABELS = ['基本情報', '映像'];

export const CreatePackageWizardView: React.FC<
  CreatePackageWizardViewProps
> = ({
  open,
  activeStep,
  form,
  errors,
  isCreating,
  selection,
  onClose,
  onBack,
  onNext,
  onFormChange,
  onSelectVideo,
  onSelectVideos,
  onSelectVideosAsAngles,
  onAddYoutubeClip,
  onAddDroppedVideos,
  onAddAngle,
  onRemoveAngle,
  onUpdateAngleName,
  onRemoveClip,
  onUpdateClip,
  onReorderClip,
  onMoveClip,
}) => {
  const assignedClipCount = selection.angles.reduce(
    (count, angle) =>
      count + angle.clips.filter((clip) => clip.source.trim()).length,
    0,
  );

  return (
    <Dialog
      open={open}
      onClose={isCreating ? undefined : onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          height: { xs: '100%', md: 'min(720px, 92vh)' },
          m: { xs: 0, md: 3 },
          borderRadius: { xs: 0, md: 2 },
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: (dialogTheme) =>
            `1px solid ${dialogTheme.palette.divider}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <VideoFileIcon color="primary" />
          <Typography variant="h6">新規パッケージ</Typography>
        </Stack>
      </Box>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.5,
            borderBottom: (contentTheme) =>
              `1px solid ${contentTheme.palette.divider}`,
          }}
        >
          <Stepper
            activeStep={activeStep}
            orientation="horizontal"
            alternativeLabel
          >
            {STEP_LABELS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Box
          sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: { xs: 2, md: 3 } }}
        >
          {activeStep === 0 && (
            <BasicInfoStep
              form={form}
              errors={errors}
              onChange={onFormChange}
            />
          )}

          {activeStep === 1 && (
            <VideoSelectionStep
              angles={selection.angles}
              onSelectVideo={onSelectVideo}
              onSelectVideos={onSelectVideos}
              onSelectVideosAsAngles={onSelectVideosAsAngles}
              onAddYoutubeClip={onAddYoutubeClip}
              onAddDroppedVideos={onAddDroppedVideos}
              onAddAngle={onAddAngle}
              onRemoveAngle={onRemoveAngle}
              onUpdateAngleName={onUpdateAngleName}
              onRemoveClip={onRemoveClip}
              onUpdateClip={onUpdateClip}
              onReorderClip={onReorderClip}
              onMoveClip={onMoveClip}
            />
          )}
        </Box>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Stack spacing={0.75} sx={{ width: '100%' }}>
          {activeStep === 1 && (
            <Typography variant="caption" color="text.secondary">
              {selection.angles.length}アングル・{assignedClipCount}本
              {selection.selectedDirectory
                ? ` ／ 保存先: ${selection.selectedDirectory}`
                : ' ／ 保存先は作成時に選択します'}
            </Typography>
          )}
          <WizardFooter
            activeStep={activeStep}
            totalSteps={STEP_LABELS.length}
            onCancel={onClose}
            onBack={onBack}
            onNext={onNext}
            isCreating={isCreating}
          />
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
