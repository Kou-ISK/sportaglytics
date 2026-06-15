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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { DirectoryStep } from './steps/DirectoryStep';
import { VideoSelectionStep } from './steps/VideoSelectionStep';
import { SummaryStep } from './steps/SummaryStep';
import { WizardFooter } from './WizardFooter';
import type { WizardFormState, WizardSelectionState } from './types';
import type { WizardSummaryItem } from './WizardSummaryBuilder';

interface CreatePackageWizardViewProps {
  open: boolean;
  activeStep: number;
  form: WizardFormState;
  errors: Partial<WizardFormState>;
  isCreating: boolean;
  selection: WizardSelectionState;
  summaryItems: WizardSummaryItem[];
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onFormChange: (updates: Partial<WizardFormState>) => void;
  onSelectDirectory: () => Promise<void>;
  onSelectVideo: (angleId: string) => Promise<void>;
  onAddAngle: () => void;
  onRemoveAngle: (angleId: string) => void;
  onUpdateAngleName: (angleId: string, name: string) => void;
}

const STEP_LABELS = ['詳細', '保存先', '映像', '確認'];

export const CreatePackageWizardView: React.FC<
  CreatePackageWizardViewProps
> = ({
  open,
  activeStep,
  form,
  errors,
  isCreating,
  selection,
  summaryItems,
  onClose,
  onBack,
  onNext,
  onFormChange,
  onSelectDirectory,
  onSelectVideo,
  onAddAngle,
  onRemoveAngle,
  onUpdateAngleName,
}) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Dialog
      open={open}
      onClose={isCreating ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          height: { xs: '100%', md: 'min(760px, 92vh)' },
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
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', md: 180 },
            flexShrink: 0,
            p: { xs: 2, md: 3 },
            borderRight: {
              xs: 'none',
              md: (contentTheme) => `1px solid ${contentTheme.palette.divider}`,
            },
            borderBottom: {
              xs: (contentTheme) => `1px solid ${contentTheme.palette.divider}`,
              md: 'none',
            },
          }}
        >
          <Stepper
            activeStep={activeStep}
            orientation={isCompact ? 'horizontal' : 'vertical'}
            alternativeLabel={isCompact}
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
            <DirectoryStep
              packageName={form.packageName}
              selectedDirectory={selection.selectedDirectory}
              onSelectDirectory={onSelectDirectory}
            />
          )}

          {activeStep === 2 && (
            <VideoSelectionStep
              angles={selection.angles}
              onSelectVideo={onSelectVideo}
              onAddAngle={onAddAngle}
              onRemoveAngle={onRemoveAngle}
              onUpdateAngleName={onUpdateAngleName}
            />
          )}

          {activeStep === 3 && <SummaryStep items={summaryItems} />}
        </Box>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
        <WizardFooter
          activeStep={activeStep}
          totalSteps={STEP_LABELS.length}
          onCancel={onClose}
          onBack={onBack}
          onNext={onNext}
          isCreating={isCreating}
        />
      </DialogActions>
    </Dialog>
  );
};
