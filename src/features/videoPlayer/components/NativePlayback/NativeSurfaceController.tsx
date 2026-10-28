import { registerNativeSurface } from '../../shared/nativePlayback/nativeSurfaceBinding';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { NativeSurfaceView } from './NativeSurfaceView';
import { useNativePlaybackState } from '../../shared/nativePlayback/useNativePlaybackState';
import { getNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { resolveVideoSource } from '../Player/SingleVideo/utils';

/** Controller owns the preload binding; the View receives only visual props. */
export const NativeSurfaceController = ({
  id,
  source,
  mount,
}: {
  id: string;
  source: string;
  mount: Element;
}): ReactElement | null => {
  const { controller, state } = useNativePlaybackState();
  const [generation, setGeneration] = useState<string | null>(null);
  const canvasId = `${id}-native-surface`;
  const api = window.electronAPI?.nativeSurface;
  useEffect(() => {
    if (!api || id !== 'video_0') return;
    let detached = false;
    let release: (() => void) | undefined;
    let unregister: (() => void) | undefined;
    const sourceUrl = resolveVideoSource(source).src;
    const failActive = (reason: string): void => {
      const active = getNativePlayback();
      if (active?.sourceUrl === sourceUrl) active.fail(reason);
    };
    try {
      release = api.bind(canvasId, (frame) => {
        const active = getNativePlayback();
        if (
          !detached &&
          active?.owner.generation === frame.generation &&
          active.sourceUrl === sourceUrl
        ) {
          setGeneration(frame.generation);
        }
      });
      unregister = registerNativeSurface(sourceUrl);
    } catch {
      try {
        release?.();
      } catch {
        /* The failed binding must never permit open. */
      }
      failActive('NATIVE_SURFACE_BIND_FAILED');
    }
    return () => {
      detached = true;
      unregister?.();
      try {
        release?.();
      } catch {
        failActive('NATIVE_SURFACE_RELEASE_UNCONFIRMED');
      } finally {
        failActive('NATIVE_SURFACE_DETACHED');
      }
    };
  }, [api, canvasId, id, source]);
  if (!api || id !== 'video_0') return null;
  return createPortal(
    <NativeSurfaceView
      id={canvasId}
      visible={Boolean(
        controller &&
        state.originalPreviewTime === null &&
        controller.owner.generation === generation &&
        controller.sourceUrl === resolveVideoSource(source).src,
      )}
    />,
    mount,
  );
};
