import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeGroupTimeline } from '../../shared/nativePlayback/nativeGroupTimeline';
import type { NativeGroupSurfaceRegistration } from './NativeGroupSurfaceContext';
import { getNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';

interface GroupSurfaceBinding {
  key: string;
  members: NativeGroupSurfaceRegistration[];
  presentedGeneration: string | null;
}
/** Exactly one preload pair binding, in Main selection order, after both actual
 * canvases mount. Duplicate/replaced slots never count as a complete pair. */
export const useNativeGroupSurfaces = (
  timeline: NativeGroupTimeline,
): {
  register: (surface: NativeGroupSurfaceRegistration) => () => void;
  ready: boolean;
  assertCurrent: () => void;
  hasPresented: (generation: string) => boolean;
} => {
  const slots = useRef(timeline.slots);
  slots.current = timeline.slots;
  const surfaces = useRef(new Set<NativeGroupSurfaceRegistration>());
  const [registered, setRegistered] = useState<
    NativeGroupSurfaceRegistration[]
  >([]);
  const binding = useRef<GroupSurfaceBinding | null>(null);
  const [boundKey, setBoundKey] = useState<string | null>(null);
  const register = useCallback(
    (surface: NativeGroupSurfaceRegistration): (() => void) => {
      surfaces.current.add(surface);
      setRegistered([...surfaces.current]);
      return () => {
        surfaces.current.delete(surface);
        setRegistered([...surfaces.current]);
      };
    },
    [],
  );
  const assertCurrent = useCallback((): void => {
    const active = binding.current;
    if (
      !active ||
      active.key !== timeline.key ||
      surfaces.current.size !== 2 ||
      active.members.some((member) => !surfaces.current.has(member))
    )
      throw Error('NATIVE_GROUP_SURFACES_CHANGED');
  }, [timeline.key]);
  useEffect(() => {
    const api = window.electronAPI?.nativeGroupSurface;
    if (!api || registered.length !== 2) return;
    const members = slots.current.map((slot) =>
      registered.filter(
        (surface) =>
          surface.playerId === slot.playerId &&
          surface.sourceUrl === slot.sourceUrl,
      ),
    );
    const first = members[0],
      second = members[1];
    if (
      first.length !== 1 ||
      second.length !== 1 ||
      first[0] === second[0] ||
      first[0].canvasId === second[0].canvasId
    )
      return;
    let detached = false;
    let release: (() => void) | undefined;
    const captured: GroupSurfaceBinding = {
      key: timeline.key,
      members: [first[0], second[0]],
      presentedGeneration: null,
    };
    const fail = (reason: string): void => {
      if (binding.current === captured) getNativePlayback()?.fail(reason);
    };
    try {
      release = api.bind([first[0].canvasId, second[0].canvasId], (pair) => {
        const controller = getNativePlayback();
        if (
          !detached &&
          binding.current === captured &&
          controller?.owner.generation === pair.generation &&
          captured.members.every((member) => surfaces.current.has(member))
        ) {
          captured.presentedGeneration = pair.generation;
          captured.members.forEach((member) =>
            member.presented(pair.generation),
          );
        }
      });
      binding.current = captured;
      setBoundKey(timeline.key);
    } catch {
      try {
        release?.();
      } catch {
        /* No authority was published for this failed bind. */
      }
      setBoundKey(null);
    }
    return () => {
      detached = true;
      fail('NATIVE_GROUP_SURFACES_DETACHED');
      if (binding.current === captured) binding.current = null;
      setBoundKey(null);
      try {
        release?.();
      } catch {
        getNativePlayback()?.fail('NATIVE_GROUP_SURFACES_RELEASE_UNCONFIRMED');
      }
    };
  }, [timeline.key, registered]);
  const hasPresented = useCallback(
    (generation: string): boolean =>
      binding.current?.presentedGeneration === generation,
    [],
  );
  return {
    register,
    ready: boundKey === timeline.key,
    assertCurrent,
    hasPresented,
  };
};
