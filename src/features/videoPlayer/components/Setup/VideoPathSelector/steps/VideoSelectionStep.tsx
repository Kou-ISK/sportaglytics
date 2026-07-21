import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AngleSelection } from '../types';
import { VideoSelectionStepView } from './VideoSelectionStepView';

export interface VideoSelectionStepProps {
  angles: AngleSelection[];
  onSelectVideo: (angleId: string, clipId: string) => void;
  onSelectVideos: (angleId: string) => void;
  onAddAngle: () => void;
  onRemoveAngle: (angleId: string) => void;
  onUpdateAngleName: (angleId: string, name: string) => void;
  onAddClip: (angleId: string) => void;
  onRemoveClip: (angleId: string, clipId: string) => void;
  onUpdateClip: (
    angleId: string,
    clipId: string,
    updates: Partial<{
      sourceKind: 'local' | 'youtube';
      source: string;
      gapBeforeSeconds: number;
    }>,
  ) => void;
  onReorderClip: (
    angleId: string,
    activeClipId: string,
    overClipId: string,
  ) => void;
  onMoveClip: (angleId: string, clipId: string, direction: -1 | 1) => void;
}

export const VideoSelectionStep: React.FC<VideoSelectionStepProps> = (
  props,
) => {
  const { angles } = props;
  const [selectedAngleId, setSelectedAngleId] = useState(
    () => angles[0]?.id ?? '',
  );
  const [selectedClipId, setSelectedClipId] = useState(
    () => angles[0]?.clips[0]?.id ?? '',
  );
  const selectNewAngleRef = useRef(false);
  const selectNewClipForAngleRef = useRef<string | null>(null);

  const selectedAngle =
    angles.find((angle) => angle.id === selectedAngleId) ?? angles[0];

  useEffect(() => {
    if (selectNewAngleRef.current && angles.length > 0) {
      const angle = angles[angles.length - 1];
      setSelectedAngleId(angle.id);
      setSelectedClipId(angle.clips[0]?.id ?? '');
      selectNewAngleRef.current = false;
      return;
    }
    if (selectedAngle && selectedAngle.id !== selectedAngleId) {
      setSelectedAngleId(selectedAngle.id);
    }
  }, [angles, selectedAngle, selectedAngleId]);

  useEffect(() => {
    if (!selectedAngle) return;
    if (selectNewClipForAngleRef.current === selectedAngle.id) {
      setSelectedClipId(selectedAngle.clips.at(-1)?.id ?? '');
      selectNewClipForAngleRef.current = null;
      return;
    }
    if (!selectedAngle.clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(selectedAngle.clips[0]?.id ?? '');
    }
  }, [selectedAngle, selectedClipId]);

  const handleSelectAngle = useCallback(
    (angleId: string): void => {
      const angle = angles.find((candidate) => candidate.id === angleId);
      setSelectedAngleId(angleId);
      setSelectedClipId(angle?.clips[0]?.id ?? '');
    },
    [angles],
  );

  const handleAddAngle = useCallback((): void => {
    selectNewAngleRef.current = true;
    props.onAddAngle();
  }, [props]);

  const handleAddClip = useCallback((): void => {
    if (!selectedAngle) return;
    selectNewClipForAngleRef.current = selectedAngle.id;
    props.onAddClip(selectedAngle.id);
  }, [props, selectedAngle]);

  return (
    <VideoSelectionStepView
      {...props}
      selectedAngle={selectedAngle}
      selectedClipId={selectedClipId}
      onSelectAngle={handleSelectAngle}
      onSelectClip={setSelectedClipId}
      onAddAngle={handleAddAngle}
      onAddClip={handleAddClip}
    />
  );
};
