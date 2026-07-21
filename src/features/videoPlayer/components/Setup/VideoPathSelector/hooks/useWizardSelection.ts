import { useCallback, useState } from 'react';
import type { ClipSelection, WizardSelectionState } from '../types';
import {
  selectPackageDirectory,
  selectVideoFile,
  selectVideoFiles,
} from '../gateway/packageGateway';

interface UseWizardSelectionParams {
  createAngleId: () => string;
  createClipId: () => string;
  createInitialSelection: () => WizardSelectionState;
  showError: (message: string) => void;
}

export const useWizardSelection = ({
  createAngleId,
  createClipId,
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
    async (angleId: string, clipId: string) => {
      try {
        const path = await selectVideoFile();
        if (path) {
          setSelection((prev) => ({
            ...prev,
            angles: prev.angles.map((angle) =>
              angle.id === angleId
                ? {
                    ...angle,
                    clips: angle.clips.map((clip) =>
                      clip.id === clipId ? { ...clip, source: path } : clip,
                    ),
                  }
                : angle,
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
      if (prev.angles.length >= 8) return prev;
      const newAngleId = createAngleId();
      const nextIndex = prev.angles.length + 1;
      return {
        ...prev,
        angles: [
          ...prev.angles,
          {
            id: newAngleId,
            name: `Angle ${nextIndex}`,
            clips: [
              {
                id: createClipId(),
                sourceKind: 'local',
                source: '',
                gapBeforeSeconds: 0,
              },
            ],
          },
        ],
      };
    });
  }, [createAngleId, createClipId]);

  const handleSelectVideos = useCallback(
    async (angleId: string) => {
      try {
        const paths = await selectVideoFiles();
        if (paths.length === 0) return;
        setSelection((prev) => ({
          ...prev,
          angles: prev.angles.map((angle) => {
            if (angle.id !== angleId) return angle;
            const selectedClips: ClipSelection[] = paths
              .slice(0, 16)
              .map((source) => ({
                id: createClipId(),
                sourceKind: 'local',
                source,
                gapBeforeSeconds: 0,
              }));
            const retainedClips =
              angle.clips.length === 1 && !angle.clips[0].source
                ? []
                : angle.clips;
            return {
              ...angle,
              clips: [...retainedClips, ...selectedClips].slice(0, 16),
            };
          }),
        }));
      } catch {
        showError('映像ファイルを選択できませんでした。');
      }
    },
    [createClipId, showError],
  );

  const handleAddClip = useCallback(
    (angleId: string) => {
      setSelection((prev) => ({
        ...prev,
        angles: prev.angles.map((angle) =>
          angle.id === angleId && angle.clips.length < 16
            ? {
                ...angle,
                clips: [
                  ...angle.clips,
                  {
                    id: createClipId(),
                    sourceKind: 'local',
                    source: '',
                    gapBeforeSeconds: 0,
                  },
                ],
              }
            : angle,
        ),
      }));
    },
    [createClipId],
  );

  const handleRemoveClip = useCallback((angleId: string, clipId: string) => {
    setSelection((prev) => ({
      ...prev,
      angles: prev.angles.map((angle) =>
        angle.id === angleId && angle.clips.length > 1
          ? {
              ...angle,
              clips: angle.clips.filter((clip) => clip.id !== clipId),
            }
          : angle,
      ),
    }));
  }, []);

  const handleUpdateClip = useCallback(
    (
      angleId: string,
      clipId: string,
      updates: Partial<{
        sourceKind: 'local' | 'youtube';
        source: string;
        gapBeforeSeconds: number;
      }>,
    ) => {
      setSelection((prev) => ({
        ...prev,
        angles: prev.angles.map((angle) =>
          angle.id === angleId
            ? {
                ...angle,
                clips: angle.clips.map((clip) =>
                  clip.id === clipId ? { ...clip, ...updates } : clip,
                ),
              }
            : angle,
        ),
      }));
    },
    [],
  );

  const handleReorderClip = useCallback(
    (angleId: string, activeClipId: string, overClipId: string) => {
      if (activeClipId === overClipId) return;
      setSelection((prev) => ({
        ...prev,
        angles: prev.angles.map((angle) => {
          if (angle.id !== angleId) return angle;
          const fromIndex = angle.clips.findIndex(
            (clip) => clip.id === activeClipId,
          );
          const toIndex = angle.clips.findIndex(
            (clip) => clip.id === overClipId,
          );
          if (fromIndex < 0 || toIndex < 0) return angle;
          const clips = [...angle.clips];
          const [moved] = clips.splice(fromIndex, 1);
          clips.splice(toIndex, 0, moved);
          return { ...angle, clips };
        }),
      }));
    },
    [],
  );

  const handleMoveClip = useCallback(
    (angleId: string, clipId: string, direction: -1 | 1) => {
      setSelection((prev) => ({
        ...prev,
        angles: prev.angles.map((angle) => {
          if (angle.id !== angleId) return angle;
          const currentIndex = angle.clips.findIndex(
            (clip) => clip.id === clipId,
          );
          const nextIndex = currentIndex + direction;
          if (
            currentIndex < 0 ||
            nextIndex < 0 ||
            nextIndex >= angle.clips.length
          ) {
            return angle;
          }
          const clips = [...angle.clips];
          [clips[currentIndex], clips[nextIndex]] = [
            clips[nextIndex],
            clips[currentIndex],
          ];
          return { ...angle, clips };
        }),
      }));
    },
    [],
  );

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
    handleSelectVideos,
    handleAddAngle,
    handleRemoveAngle,
    handleUpdateAngleName,
    handleAddClip,
    handleRemoveClip,
    handleUpdateClip,
    handleReorderClip,
    handleMoveClip,
  };
};
