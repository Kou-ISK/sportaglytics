import React, { useMemo } from 'react';
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
import type { VideoSyncData } from '../../../../../types/VideoSync';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { ActionList } from '../../../../../ActionList';
import type {
  PackageLoadResult,
  SyncStatus,
  WizardSelectionState,
} from './types';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { DirectoryStep } from './steps/DirectoryStep';
import { VideoSelectionStep } from './steps/VideoSelectionStep';
import { SummaryStep } from './steps/SummaryStep';
import { WizardFooter } from './WizardFooter';
import { WizardSyncAlert } from './WizardSyncAlert';
import { buildWizardSummaryItems } from './WizardSummaryBuilder';
import { useCreatePackageFlow } from './hooks/useCreatePackageFlow';
import { useWizardSelection } from './hooks/useWizardSelection';

interface CreatePackageWizardProps {
  open: boolean;
  onClose: () => void;
  onPackageCreated: (payload: PackageLoadResult) => void;
  performAudioSync: (
    tightPath: string,
    widePath: string,
  ) => Promise<VideoSyncData>;
  syncStatus: SyncStatus;
}

const STEPS = ['基本情報', '保存先選択', '映像ファイル選択', '確認'];

const createAngleId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `angle-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createInitialSelection = (): WizardSelectionState => {
  const firstAngleId = createAngleId();
  return {
    selectedDirectory: '',
    angles: [
      {
        id: firstAngleId,
        name: 'Angle 1',
        filePath: '',
      },
    ],
  };
};

export const CreatePackageWizard: React.FC<CreatePackageWizardProps> = ({
  open,
  onClose,
  onPackageCreated,
  syncStatus,
}) => {
  const { error: showError } = useNotification();
  const {
    selection,
    resetSelection,
    handleSelectDirectory,
    handleSelectVideo,
    handleAddAngle,
    handleRemoveAngle,
    handleUpdateAngleName,
  } = useWizardSelection({
    createAngleId,
    createInitialSelection,
    showError,
  });
  const {
    form,
    setForm,
    activeStep,
    errors,
    handleNext,
    handleBack,
  } = useCreatePackageFlow({
    open,
    onClose,
    onPackageCreated,
    selection,
    resetSelection,
    handleSelectDirectory,
    showError,
    actionNames: ActionList.map((item) => item.action),
  });
  const isAnalyzing = syncStatus.isAnalyzing;

  const summaryItems = useMemo(
    () => buildWizardSummaryItems(form, selection),
    [form, selection],
  );

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
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <BasicInfoStep
            form={form}
            errors={errors}
            onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
          />
        )}

        {activeStep === 1 && (
          <DirectoryStep
            packageName={form.packageName}
            selectedDirectory={selection.selectedDirectory}
            onSelectDirectory={handleSelectDirectory}
          />
        )}

        {activeStep === 2 && (
          <VideoSelectionStep
            isAnalyzing={isAnalyzing}
            angles={selection.angles}
            onSelectVideo={handleSelectVideo}
            onAddAngle={handleAddAngle}
            onRemoveAngle={handleRemoveAngle}
            onUpdateAngleName={handleUpdateAngleName}
          />
        )}

        {activeStep === 3 && <SummaryStep items={summaryItems} />}

        <WizardSyncAlert syncStatus={syncStatus} />

        <WizardFooter
          activeStep={activeStep}
          totalSteps={STEPS.length}
          isAnalyzing={isAnalyzing}
          onCancel={onClose}
          onBack={handleBack}
          onNext={handleNext}
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
