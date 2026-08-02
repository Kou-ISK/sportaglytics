import React from 'react';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { ActionList } from '../../../../../ActionList';
import type { PackageLoadResult, WizardSelectionState } from './types';
import { useCreatePackageFlow } from './hooks/useCreatePackageFlow';
import { useWizardSelection } from './hooks/useWizardSelection';
import { CreatePackageWizardView } from './CreatePackageWizardView';

interface CreatePackageWizardProps {
  open: boolean;
  onClose: () => void;
  onPackageCreated: (payload: PackageLoadResult) => void;
}

const createAngleId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `angle-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createClipId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createInitialSelection = (): WizardSelectionState => {
  const firstAngleId = createAngleId();
  return {
    selectedDirectory: '',
    angles: [
      {
        id: firstAngleId,
        name: 'Angle 1',
        clips: [],
      },
    ],
  };
};

export const CreatePackageWizard: React.FC<CreatePackageWizardProps> = ({
  open,
  onClose,
  onPackageCreated,
}) => {
  const { error: showError } = useNotification();
  const {
    selection,
    resetSelection,
    handleSelectDirectory,
    handleSelectVideo,
    handleSelectVideos,
    handleSelectVideosAsAngles,
    handleAddYoutubeClip,
    handleAddDroppedVideos,
    handleAddAngle,
    handleRemoveAngle,
    handleUpdateAngleName,
    handleRemoveClip,
    handleUpdateClip,
    handleReorderClip,
    handleMoveClip,
  } = useWizardSelection({
    createAngleId,
    createClipId,
    createInitialSelection,
    showError,
  });
  const {
    form,
    setForm,
    activeStep,
    errors,
    isCreating,
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

  return (
    <CreatePackageWizardView
      open={open}
      activeStep={activeStep}
      form={form}
      errors={errors}
      isCreating={isCreating}
      selection={selection}
      onClose={onClose}
      onBack={handleBack}
      onNext={handleNext}
      onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
      onSelectVideo={handleSelectVideo}
      onSelectVideos={handleSelectVideos}
      onSelectVideosAsAngles={handleSelectVideosAsAngles}
      onAddYoutubeClip={handleAddYoutubeClip}
      onAddDroppedVideos={handleAddDroppedVideos}
      onAddAngle={handleAddAngle}
      onRemoveAngle={handleRemoveAngle}
      onUpdateAngleName={handleUpdateAngleName}
      onRemoveClip={handleRemoveClip}
      onUpdateClip={handleUpdateClip}
      onReorderClip={handleReorderClip}
      onMoveClip={handleMoveClip}
    />
  );
};
