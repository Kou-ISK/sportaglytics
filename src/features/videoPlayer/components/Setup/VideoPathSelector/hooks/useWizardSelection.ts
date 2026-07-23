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

  const handleSelectDirectory = useCallback(async (): Promise<
    string | null
  > => {
    try {
      const directory = await selectPackageDirectory();
      if (directory) {
        setSelection((prev) => ({ ...prev, selectedDirectory: directory }));
      }
      return directory || null;
    } catch {
      showError('この機能はElectronアプリケーション内でのみ利用できます。');
      return null;
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
            clips: [],
          },
        ],
      };
    });
  }, [createAngleId]);

  const handleSelectVideos = useCallback(
    async (angleId: string) => {
      try {
        const paths = await selectVideoFiles();
        if (paths.length === 0) return;
        setSelection((prev) => ({
          ...prev,
          angles: prev.angles.map((angle) => {
            if (angle.id !== angleId) return angle;
            if (
              angle.clips.some(
                (clip) => clip.source.trim() && clip.sourceKind === 'youtube',
              )
            ) {
              showError(
                '同じアングル内でローカル映像とYouTubeは混在できません。',
              );
              return angle;
            }
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

  const handleAddDroppedVideos = useCallback(
    (angleId: string, paths: string[]) => {
      const validPaths = paths.filter((source) =>
        /\.(?:mp4|mov|m4v|webm)$/i.test(source),
      );
      if (validPaths.length !== paths.length) {
        showError('対応していないファイルは追加されませんでした。');
      }
      if (validPaths.length === 0) return;
      setSelection((prev) => ({
        ...prev,
        angles: prev.angles.map((angle) => {
          if (angle.id !== angleId) return angle;
          const retainedClips = angle.clips.filter((clip) =>
            clip.source.trim(),
          );
          if (retainedClips.some((clip) => clip.sourceKind === 'youtube')) {
            showError(
              '同じアングル内でローカル映像とYouTubeは混在できません。',
            );
            return angle;
          }
          const available = Math.max(0, 16 - retainedClips.length);
          return {
            ...angle,
            clips: [
              ...retainedClips,
              ...validPaths.slice(0, available).map((source) => ({
                id: createClipId(),
                sourceKind: 'local' as const,
                source,
                gapBeforeSeconds: 0,
              })),
            ],
          };
        }),
      }));
    },
    [createClipId, showError],
  );

  const handleSelectVideosAsAngles = useCallback(async () => {
    try {
      const paths = await selectVideoFiles();
      if (paths.length === 0) return;
      setSelection((prev) => {
        const firstAngleIsEmpty =
          prev.angles.length === 1 && prev.angles[0].clips.length === 0;
        const availableSlots =
          8 - prev.angles.length + (firstAngleIsEmpty ? 1 : 0);
        const selectedPaths = paths.slice(0, availableSlots);
        if (selectedPaths.length === 0) return prev;

        const newAngles = selectedPaths.map((source, index) => ({
          id: createAngleId(),
          name: `Angle ${prev.angles.length + index + (firstAngleIsEmpty ? 0 : 1)}`,
          clips: [
            {
              id: createClipId(),
              sourceKind: 'local' as const,
              source,
              gapBeforeSeconds: 0,
            },
          ],
        }));

        return {
          ...prev,
          angles: [...(firstAngleIsEmpty ? [] : prev.angles), ...newAngles],
        };
      });
    } catch {
      showError('映像ファイルを選択できませんでした。');
    }
  }, [createAngleId, createClipId, showError]);

  const handleAddYoutubeClip = useCallback(
    (angleId: string, source: string) => {
      setSelection((prev) => {
        return {
          ...prev,
          angles: prev.angles.map((angle) => {
            if (angle.id !== angleId || angle.clips.length >= 16) return angle;
            const retainedClips = angle.clips.filter((clip) =>
              clip.source.trim(),
            );
            if (retainedClips.some((clip) => clip.sourceKind !== 'youtube')) {
              showError(
                '同じアングル内でローカル映像とYouTubeは混在できません。',
              );
              return angle;
            }
            return {
              ...angle,
              clips: [
                ...retainedClips,
                {
                  id: createClipId(),
                  sourceKind: 'youtube' as const,
                  source,
                  gapBeforeSeconds: 0,
                },
              ],
            };
          }),
        };
      });
    },
    [createClipId, showError],
  );

  const handleRemoveClip = useCallback((angleId: string, clipId: string) => {
    setSelection((prev) => ({
      ...prev,
      angles: prev.angles.map((angle) =>
        angle.id === angleId
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
  };
};
