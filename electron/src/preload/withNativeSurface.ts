import type { IElectronAPI } from '../../../src/renderer';
import { createSurfaceBridge } from './nativeSurfaceBridge';
import {
  parseNativePlaybackIntent,
  parseNativePlaybackOwner,
} from '../../../src/types/ipc/nativePlayback';
import type { NativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';
export const nativeSurface = createSurfaceBridge();
let surfaceCloseFailure: unknown;
export const withSurface = (api: IElectronAPI): IElectronAPI => {
  let owner: NativePlaybackOwner | null = null;
  let lifecycle = 0;
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
    nativePlayback: {
      ...api.nativePlayback,
      open: async (rawOwner) => {
        const next = parseNativePlaybackOwner(rawOwner),
          revision = ++lifecycle;
        await api.nativePlayback.open(next);
        if (revision === lifecycle) owner = next;
      },
      prepareSeek: (rawIntent) => {
        const intent = parseNativePlaybackIntent(rawIntent);
        if (
          !owner ||
          intent.generation !== owner.generation ||
          intent.sourceKey !== owner.sourceKey ||
          intent.playing
        )
          throw Error('surface owner unavailable');
        nativeSurface.prepare(intent.generation, intent.seekId);
      },
      apply: async (intent) => {
        nativeSurface.expect(intent.generation, intent.seekId);
        await api.nativePlayback.apply(intent);
      },
      close: async (closingOwner) => {
        owner = null;
        ++lifecycle;
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
