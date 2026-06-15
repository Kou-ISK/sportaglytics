import { useCallback, useEffect, useState } from 'react';
import type {
  PackageLoadResult,
  WizardFormState,
  WizardSelectionState,
} from '../types';
import { createVideoPackage } from '../gateway/packageGateway';
import {
  buildAnglePayloads,
  buildMetaDataConfig,
  buildPackageLoadResult,
} from '../utils/packageCreationMappers';

interface UseCreatePackageFlowParams {
  open: boolean;
  onClose: () => void;
  onPackageCreated: (payload: PackageLoadResult) => void;
  selection: WizardSelectionState;
  resetSelection: () => void;
  handleSelectDirectory: () => Promise<void>;
  showError: (message: string) => void;
  actionNames: string[];
}

const INITIAL_FORM: WizardFormState = {
  packageName: '',
  team1Name: '',
  team2Name: '',
};

const TOTAL_STEPS = 4;

export const useCreatePackageFlow = ({
  open,
  onClose,
  onPackageCreated,
  selection,
  resetSelection,
  handleSelectDirectory,
  showError,
  actionNames,
}: UseCreatePackageFlowParams) => {
  const [form, setForm] = useState<WizardFormState>(INITIAL_FORM);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState<Partial<WizardFormState>>({});
  const [hasPromptedDirectory, setHasPromptedDirectory] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(INITIAL_FORM);
    resetSelection();
    setActiveStep(0);
    setErrors({});
    setHasPromptedDirectory(false);
    setIsCreating(false);
  }, [open, resetSelection]);

  const validateStep = useCallback(
    (step: number): boolean => {
      const nextErrors: Partial<WizardFormState> = {};
      if (step === 0) {
        if (!form.packageName.trim()) {
          nextErrors.packageName = 'パッケージ名を入力してください';
        }
        if (!form.team1Name.trim()) {
          nextErrors.team1Name = 'チーム名(1)を入力してください';
        }
        if (!form.team2Name.trim()) {
          nextErrors.team2Name = 'チーム名(2)を入力してください';
        }
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [form],
  );

  useEffect(() => {
    if (
      activeStep === 1 &&
      !selection.selectedDirectory &&
      !hasPromptedDirectory
    ) {
      setHasPromptedDirectory(true);
      void handleSelectDirectory();
    }
  }, [
    activeStep,
    handleSelectDirectory,
    hasPromptedDirectory,
    selection.selectedDirectory,
  ]);

  const executeCreatePackage = useCallback(async () => {
    if (isCreating) {
      return;
    }

    const anglePayloads = buildAnglePayloads(selection);
    if (!anglePayloads.length) {
      showError('少なくとも1つのアングルに映像を割り当ててください。');
      return;
    }

    const metaDataConfig = buildMetaDataConfig(
      form,
      actionNames,
      anglePayloads,
    );

    try {
      setIsCreating(true);
      const packageDatas = await createVideoPackage(
        selection.selectedDirectory,
        form.packageName,
        anglePayloads,
        metaDataConfig,
      );

      if (!packageDatas) {
        throw new Error('Failed to create package');
      }

      onPackageCreated(buildPackageLoadResult(packageDatas, selection, form));
      onClose();
    } catch (error) {
      console.error('パッケージ作成に失敗しました:', error);
      showError(
        error instanceof Error && error.message === 'ELECTRON_API_UNAVAILABLE'
          ? 'この機能はElectronアプリケーション内でのみ利用できます。'
          : 'パッケージの作成中にエラーが発生しました。',
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    actionNames,
    form,
    isCreating,
    onClose,
    onPackageCreated,
    selection,
    showError,
  ]);

  const handleNext = useCallback(async () => {
    if (isCreating) {
      return;
    }

    if (!validateStep(activeStep)) {
      return;
    }

    if (activeStep === 1 && !selection.selectedDirectory) {
      await handleSelectDirectory();
      return;
    }

    if (activeStep === 2) {
      const primaryAngle = selection.angles[0];
      if (!primaryAngle?.filePath) {
        showError('メインアングルに映像を割り当ててください。');
        return;
      }
      if (!selection.angles.some((angle) => angle.filePath)) {
        showError('少なくとも1つのアングルに映像を割り当ててください。');
        return;
      }
    }

    if (activeStep === TOTAL_STEPS - 1) {
      await executeCreatePackage();
      return;
    }

    setActiveStep((prev) => prev + 1);
  }, [
    activeStep,
    executeCreatePackage,
    handleSelectDirectory,
    isCreating,
    selection,
    showError,
    validateStep,
  ]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    form,
    setForm,
    activeStep,
    errors,
    isCreating,
    handleNext,
    handleBack,
  };
};
