import { useContext, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { NativeGroupSurfaceContext } from './NativeGroupSurfaceContext';
import { NativeSurfaceView } from './NativeSurfaceView';
import { resolveVideoSource } from '../Player/SingleVideo/utils';
import { useNativePlaybackState } from '../../shared/nativePlayback/useNativePlaybackState';
import { getNativePlaybackGroup } from '../../shared/nativePlayback/nativePlaybackRegistry';
export const NativeGroupSurfaceController = ({
  id,
  source,
  mount,
}: {
  id: string;
  source: string;
  mount: Element;
}): ReactElement | null => {
  const context = useContext(NativeGroupSurfaceContext);
  const { controller, state } = useNativePlaybackState();
  const [generation, setGeneration] = useState<string | null>(null);
  const canvasId = `${id}-native-group-surface`;
  const sourceUrl = resolveVideoSource(source).src;
  useEffect(
    () =>
      context?.register({
        playerId: id,
        sourceUrl,
        canvasId,
        presented: setGeneration,
      }),
    [context, id, sourceUrl, canvasId],
  );
  const group = getNativePlaybackGroup();
  return createPortal(
    <NativeSurfaceView
      id={canvasId}
      visible={Boolean(
        controller &&
        state.originalPreviewTime === null &&
        generation === controller.owner.generation &&
        group?.angles.some((angle) => angle.sourceUrl === sourceUrl),
      )}
    />,
    mount,
  );
};
