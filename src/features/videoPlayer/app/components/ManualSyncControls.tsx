import type { ReactElement } from 'react';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import { useClipTimelineSyncController } from '../hooks/sync/useClipTimelineSyncController';
import { ClipSyncControlsView } from './ClipSyncControlsView';
import { ClipSyncPreviewView } from './ClipSyncPreviewView';
import { useClipSyncTransport } from '../hooks/sync/useClipSyncTransport';

interface ManualSyncControlsProps {
  onApplySync: () => void | Promise<void>;
  onCancel: () => void;
  mediaAngles: PackageMediaAngle[];
  syncData?: VideoSyncData;
  metaDataConfigFilePath: string;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  setVideoList: Dispatch<SetStateAction<string[]>>;
}

export const ManualSyncControls = (
  props: ManualSyncControlsProps,
): ReactElement => {
  const controller = useClipTimelineSyncController(props);
  const transport = useClipSyncTransport(controller);
  const previews = (['reference', 'target'] as const).map((side) => {
    const media = side === 'reference' ? transport.first : transport.second;
    const clip =
      side === 'reference' ? controller.reference : controller.target;
    return (
      <ClipSyncPreviewView
        key={side}
        label={side === 'reference' ? '基準' : '配置対象'}
        id={media.id}
        clipId={clip?.id ?? ''}
        clips={controller.clips}
        containerRef={media.containerRef}
        videoRef={media.videoRef}
        active={transport.active === side}
        busy={transport.busy}
        ready={media.isReady && !media.error}
        playing={media.playing}
        time={media.time}
        duration={media.durationSec}
        error={media.error}
        frameRate={transport.frameRate}
        onActivate={() => transport.setActive(side)}
        onSelect={(id) => transport.select(side, id)}
        onToggle={() => transport.toggle(side)}
        onSeek={(time) => transport.seek(side, time)}
        onStep={(seconds) => transport.step(side, seconds)}
      />
    );
  });
  return (
    <ClipSyncControlsView
      {...controller}
      {...transport}
      referencePreview={previews[0]}
      targetPreview={previews[1]}
      clips={controller.clips.map((clip) => ({
        id: clip.id,
        angleId: clip.angleId,
        angleName: clip.angleName,
        name: clip.source.split(/[\\/]/).pop() ?? '',
        start:
          (controller.placements[clip.id] ?? clip.timelineStartSeconds) -
          controller.offsetFor(clip),
        duration: clip.durationSeconds ?? 0,
        changed: controller.placements[clip.id] !== undefined,
      }))}
      onFrameRate={transport.setFrameRate}
      onPlace={() => {
        transport.beforeEdit();
        controller.placeAtCurrentPositions();
      }}
      onRefineAudio={() => {
        transport.beforeEdit();
        void controller.refineWithAudio();
      }}
      onApply={() => {
        transport.beforeEdit();
        void controller.applyTimeline();
      }}
      onCancel={controller.cancel}
      onReset={() => {
        transport.beforeEdit();
        controller.resetPlacements();
      }}
      onSelect={(id) => {
        const clip = controller.clips.find((item) => item.id === id);
        transport.select(
          clip?.angleId === controller.reference?.angleId
            ? 'reference'
            : 'target',
          id,
        );
      }}
      onMoveTarget={(seconds) => {
        transport.beforeEdit();
        controller.moveTarget(seconds);
      }}
    />
  );
};
