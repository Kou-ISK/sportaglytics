import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import { useClipTimelineSyncController } from '../hooks/sync/useClipTimelineSyncController';
import { ClipSyncControlsView } from './ClipSyncControlsView';

interface ManualSyncControlsProps {
  onApplySync: () => void | Promise<void>;
  onCancel: () => void;
  mediaAngles: PackageMediaAngle[];
  metaDataConfigFilePath: string;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  setVideoList: Dispatch<SetStateAction<string[]>>;
}

export const ManualSyncControls = (props: ManualSyncControlsProps) => {
  const controller = useClipTimelineSyncController(props);
  return (
    <ClipSyncControlsView
      {...controller}
      onPlace={controller.placeAtCurrentPositions}
      onRefineAudio={() => void controller.refineWithAudio()}
      onApply={() => void controller.applyTimeline()}
      onCancel={controller.cancel}
    />
  );
};
