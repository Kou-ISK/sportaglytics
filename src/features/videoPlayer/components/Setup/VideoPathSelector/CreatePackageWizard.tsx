import React, { useMemo } from 'react';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { ActionList } from '../../../../../ActionList';
import type {
  PackageLoadResult,
  WizardSelectionState,
} from './types';
import { buildWizardSummaryItems } from './WizardSummaryBuilder';
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

  const summaryItems = useMemo(
    () => buildWizardSummaryItems(form, selection),
    [form, selection],
  );

  return (
    <CreatePackageWizardView
      open={open}
      activeStep={activeStep}
      form={form}
      errors={errors}
      selection={selection}
      summaryItems={summaryItems}
      onClose={onClose}
      onBack={handleBack}
      onNext={handleNext}
      onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
      onSelectDirectory={handleSelectDirectory}
      onSelectVideo={handleSelectVideo}
      onAddAngle={handleAddAngle}
      onRemoveAngle={handleRemoveAngle}
      onUpdateAngleName={handleUpdateAngleName}
    />
  );
};
