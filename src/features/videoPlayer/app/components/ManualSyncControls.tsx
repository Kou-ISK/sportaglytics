import { useCallback, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useVideoWindowAspect } from '../../../../shared/hooks/useVideoWindowAspect';
import { videoGridAspect } from '../../../../shared/hooks/videoGridAspect';
import type { AngleSyncSession } from '../hooks/sync/useAngleSyncSession';
import { syncPointTime } from '../hooks/sync/angleSync';
import { AngleSyncWorkspaceView } from './AngleSyncWorkspaceView';
import { AngleSyncPreviewScreen } from './AngleSyncPreviewScreen';

export const ManualSyncControls = ({
  session,
}: {
  session: AngleSyncSession;
}): ReactElement => {
  const { controller, transport } = session;
  const { draft, points } = controller;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const onAspect = useCallback((index: number, ratio: number): void => {
    setRatios((current) =>
      current[index] === ratio ? current : { ...current, [index]: ratio },
    );
  }, []);
  const visibleRatios = draft.angles.flatMap((_, index) =>
    transport.selected === null || transport.selected === index
      ? [ratios[index] ?? 16 / 9]
      : [],
  );
  useVideoWindowAspect(
    rootRef,
    `angle-sync-${draft.angles.length}-${transport.selected ?? 'all'}`,
    videoGridAspect(visibleRatios),
  );
  return (
    <AngleSyncWorkspaceView
      rootRef={rootRef}
      angleCount={draft.angles.length}
      selected={transport.selected}
      previews={draft.angles.map((item, i) => (
        <AngleSyncPreviewScreen
          key={item.id}
          index={i}
          angle={item}
          offset={draft.offsets[i] ?? 0}
          time={transport.times[i] ?? 0}
          playing={
            !controller.busy &&
            transport.playing &&
            (transport.selected === null || transport.selected === i)
          }
          suspended={controller.analyzing}
          hidden={transport.selected !== null && transport.selected !== i}
          pointTime={syncPointTime(
            item,
            draft.offsets[i] ?? 0,
            points[item.id],
          )}
          onDuration={controller.recordDuration}
          onStatus={transport.onStatus}
          onAspect={onAspect}
        />
      ))}
    />
  );
};
