import type { ReactElement } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import { useAngleSyncPreview } from '../hooks/sync/useAngleSyncPreview';
import type { AnglePreviewStatus } from '../hooks/sync/useAngleSyncPreview';
import { AngleSyncPreviewView } from './AngleSyncPreviewView';

export const AngleSyncPreviewScreen = (props: {
  index: number;
  angle: PackageMediaAngle;
  offset: number;
  time: number;
  playing: boolean;
  suspended: boolean;
  hidden: boolean;
  pointTime: number | null;
  onDuration: (index: number, clipId: string, duration: number) => void;
  onStatus: (index: number, status: AnglePreviewStatus) => void;
  onAspect: (index: number, ratio: number) => void;
}): ReactElement => {
  const media = useAngleSyncPreview(props);
  return (
    <AngleSyncPreviewView
      id={media.id}
      name={props.angle.name}
      time={props.time}
      pointTime={props.pointTime}
      gap={media.gap}
      ready={media.isReady}
      error={media.error}
      containerRef={media.containerRef}
      videoRef={media.videoRef}
      hidden={props.hidden}
    />
  );
};
