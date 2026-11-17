import type { IElectronAPI } from '../../../src/renderer';
import { parseNativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';
import type { NativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';
import { createNativeGroupControlBridge } from './nativeGroupControlBridge';
import { createSurfaceBridge } from './nativeSurfaceBridge';
export const nativeSurface = createSurfaceBridge();
export const withSurface = (api: IElectronAPI): IElectronAPI => {
  let surfaceCloseFailure: unknown;
  let groupToken: object | null = null;
  let groupOwner: NativePlaybackOwner | null = null;
  let groupControls: ReturnType<typeof createNativeGroupControlBridge> | null =
    null;
  return {
    ...api,
    nativeSurface: {
      bind: (id, callback) =>
        nativeSurface.bind(id, (frame) =>
          callback({
            generation: frame.generation,
            seekId: frame.seekId,
            pts: frame.pts,
            timescale: 120000,
          }),
        ),
    },
    nativeGroupSurface: {
      bind: (ids, callback) => {
        const release = nativeSurface.group.bind(ids, callback);
        const token = {};
        groupToken = token;
        groupOwner = null;
        groupControls = null;
        return () => {
          if (groupToken !== token) return;
          try {
            release();
          } finally {
            groupToken = null;
            groupOwner = null;
            groupControls = null;
          }
        };
      },
    },
    nativePlayback: {
      ...api.nativePlayback,
      open: async (rawOwner) => {
        const owner = parseNativePlaybackOwner(rawOwner),
          token = groupToken;
        await api.nativePlayback.open(owner);
        if (token) {
          if (token !== groupToken) throw Error('NATIVE_GROUP_BINDING_CHANGED');
          groupOwner = owner;
          groupControls = createNativeGroupControlBridge(
            owner,
            nativeSurface.group,
          );
        }
      },
      freezePresentation: (intent) => {
        if (!groupToken || !groupControls)
          throw Error('NATIVE_GROUP_OWNER_NOT_OPEN');
        groupControls.freeze(intent);
      },
      apply: async (intent) => {
        if (groupToken) {
          if (!groupControls) throw Error('NATIVE_GROUP_OWNER_NOT_OPEN');
          await api.nativePlayback.apply(groupControls.prepare(intent));
          return;
        }
        if (intent.presentationFence) throw Error('NATIVE_STOP_AUTHORITY');
        nativeSurface.expect(
          intent.generation,
          intent.seekId,
          intent.sequence,
          intent.rate,
        );
        await api.nativePlayback.apply(intent);
      },
      close: async (rawOwner) => {
        const closingOwner = parseNativePlaybackOwner(rawOwner);
        if (
          groupOwner &&
          (groupOwner.generation !== closingOwner.generation ||
            groupOwner.sourceKey !== closingOwner.sourceKey)
        )
          return api.nativePlayback.close(closingOwner); // Main rejects a stale owner; do not close a newer canvas.
        try {
          nativeSurface.close();
        } catch (error) {
          surfaceCloseFailure ??= error;
        }
        const result = await api.nativePlayback.close(closingOwner);
        if (surfaceCloseFailure) throw surfaceCloseFailure;
        return result;
      },
    },
  };
};
