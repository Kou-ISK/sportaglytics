import React from 'react';
import {
  Box,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { DirectoryStep } from './steps/DirectoryStep';
import { VideoSelectionStep } from './steps/VideoSelectionStep';
import { SummaryStep } from './steps/SummaryStep';
import { WizardFooter } from './WizardFooter';
import { WizardSyncAlert } from './WizardSyncAlert';
import type {
  SyncStatus,
  WizardFormState,
  WizardSelectionState,
} from './types';
import type { WizardSummaryItem } from './WizardSummaryBuilder';

interface CreatePackageWizardViewProps {
  open: boolean;
  activeStep: number;
  form: WizardFormState;
  errors: Partial<WizardFormState>;
  selection: WizardSelectionState;
  summaryItems: WizardSummaryItem[];
  syncStatus: SyncStatus;
  isAnalyzing: boolean;
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

const STEP_LABELS = ['基本情報', '保存先選択', '映像ファイル選択', '確認'];

export const CreatePackageWizardView: React.FC<CreatePackageWizardViewProps> = ({
  open,
  activeStep,
  form,
  errors,
  selection,
  summaryItems,
  syncStatus,
  isAnalyzing,
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
  if (!open) {
    return null;
  }

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'auto',
          p: 4,
          zIndex: 1300,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <VideoFileIcon color="primary" />
          <Typography variant="h5">新規パッケージ作成</Typography>
        </Stack>

        <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
          {STEP_LABELS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <BasicInfoStep form={form} errors={errors} onChange={onFormChange} />
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
            isAnalyzing={isAnalyzing}
            angles={selection.angles}
            onSelectVideo={onSelectVideo}
            onAddAngle={onAddAngle}
            onRemoveAngle={onRemoveAngle}
            onUpdateAngleName={onUpdateAngleName}
          />
        )}

        {activeStep === 3 && <SummaryStep items={summaryItems} />}

        <WizardSyncAlert syncStatus={syncStatus} />

        <WizardFooter
          activeStep={activeStep}
          totalSteps={STEP_LABELS.length}
          isAnalyzing={isAnalyzing}
          onCancel={onClose}
          onBack={onBack}
          onNext={onNext}
        />
      </Paper>

      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1299,
        }}
        onClick={onClose}
      />
    </>
  );
};
