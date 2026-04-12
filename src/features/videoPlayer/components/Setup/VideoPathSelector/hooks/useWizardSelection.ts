import { useCallback, useState } from 'react';
import type { WizardSelectionState } from '../types';
import {
  selectPackageDirectory,
  selectVideoFile,
} from '../gateway/packageGateway';

interface UseWizardSelectionParams {
  createAngleId: () => string;
  createInitialSelection: () => WizardSelectionState;
  showError: (message: string) => void;
}

export const useWizardSelection = ({
  createAngleId,
  createInitialSelection,
  showError,
}: UseWizardSelectionParams) => {
  const [selection, setSelection] = useState<WizardSelectionState>(
    createInitialSelection(),
  );

  const resetSelection = useCallback(() => {
    setSelection(createInitialSelection());
  }, [createInitialSelection]);

  const handleSelectDirectory = useCallback(async () => {
    try {
      const directory = await selectPackageDirectory();
      if (directory) {
        setSelection((prev) => ({ ...prev, selectedDirectory: directory }));
      }
    } catch {
      showError('この機能はElectronアプリケーション内でのみ利用できます。');
    }
  }, [showError]);

  const handleSelectVideo = useCallback(
    async (angleId: string) => {
      try {
        const path = await selectVideoFile();
        if (path) {
          setSelection((prev) => ({
            ...prev,
            angles: prev.angles.map((angle) =>
              angle.id === angleId ? { ...angle, filePath: path } : angle,
            ),
          }));
        }
      } catch {
        showError('この機能はElectronアプリケーション内でのみ利用できます。');
      }
    },
    [showError],
  );

  const handleAddAngle = useCallback(() => {
    setSelection((prev) => {
      const newAngleId = createAngleId();
      const nextIndex = prev.angles.length + 1;
      return {
        ...prev,
        angles: [
          ...prev.angles,
          {
            id: newAngleId,
            name: `Angle ${nextIndex}`,
            filePath: '',
          },
        ],
      };
    });
  }, [createAngleId]);

  const handleRemoveAngle = useCallback((angleId: string) => {
    setSelection((prev) => {
      if (prev.angles.length === 1) return prev;
      const filtered = prev.angles.filter((angle) => angle.id !== angleId);
      return {
        ...prev,
        angles: filtered,
      };
    });
  }, []);

  const handleUpdateAngleName = useCallback((angleId: string, name: string) => {
    setSelection((prev) => ({
      ...prev,
      angles: prev.angles.map((angle) =>
        angle.id === angleId ? { ...angle, name } : angle,
      ),
    }));
  }, []);

  return {
    selection,
    setSelection,
    resetSelection,
    handleSelectDirectory,
    handleSelectVideo,
    handleAddAngle,
    handleRemoveAngle,
    handleUpdateAngleName,
  };
};
