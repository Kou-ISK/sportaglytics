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
  handleSelectDirectory: () => Promise<string | null>;
  showError: (message: string) => void;
  actionNames: string[];
}

const INITIAL_FORM: WizardFormState = {
  packageName: '',
  team1Name: '',
  team2Name: '',
};

const TOTAL_STEPS = 2;

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
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(INITIAL_FORM);
    resetSelection();
    setActiveStep(0);
    setErrors({});
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

  const executeCreatePackage = useCallback(
    async (directory: string) => {
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
          directory,
          form.packageName,
          anglePayloads,
          metaDataConfig,
        );

        if (!packageDatas) {
          throw new Error('Failed to create package');
        }

        onPackageCreated(buildPackageLoadResult(packageDatas, directory, form));
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
    },
    [
      actionNames,
      form,
      isCreating,
      onClose,
      onPackageCreated,
      selection,
      showError,
    ],
  );

  const handleNext = useCallback(async () => {
    if (isCreating) {
      return;
    }

    if (!validateStep(activeStep)) {
      return;
    }

    if (activeStep === 1) {
      const primaryAngle = selection.angles[0];
      if (!primaryAngle?.clips.some((clip) => clip.source.trim())) {
        showError('メインアングルに映像を割り当ててください。');
        return;
      }
      if (
        !selection.angles.some((angle) =>
          angle.clips.some((clip) => clip.source.trim()),
        )
      ) {
        showError('少なくとも1つのアングルに映像を割り当ててください。');
        return;
      }

      const invalidYoutube = selection.angles.some((angle) =>
        angle.clips.some(
          (clip) =>
            clip.sourceKind === 'youtube' &&
            !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(
              clip.source.trim(),
            ),
        ),
      );
      if (invalidYoutube) {
        showError('有効な YouTube URL を入力してください。');
        return;
      }

      const mixedYoutubeAndLocal = selection.angles.some(
        (angle) =>
          angle.clips.some((clip) => clip.sourceKind === 'youtube') &&
          angle.clips.some((clip) => clip.sourceKind === 'local'),
      );
      if (mixedYoutubeAndLocal) {
        showError('同じアングル内でローカル映像とYouTubeは混在できません。');
        return;
      }
    }

    if (activeStep === TOTAL_STEPS - 1) {
      const directory =
        selection.selectedDirectory || (await handleSelectDirectory());
      if (!directory) return;
      await executeCreatePackage(directory);
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
