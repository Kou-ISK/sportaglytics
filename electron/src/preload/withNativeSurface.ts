import type { IElectronAPI } from '../../../src/renderer';
import { createSurfaceBridge } from './nativeSurfaceBridge';
export const nativeSurface = createSurfaceBridge();
let surfaceCloseFailure: unknown;
export const withSurface = (api: IElectronAPI): IElectronAPI => ({
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
    open: async (owner) => {
      await api.nativePlayback.open(owner);
    },
    apply: async (intent) => {
      nativeSurface.expect(intent.generation, intent.seekId);
      await api.nativePlayback.apply(intent);
    },
    close: async (owner) => {
      try {
        nativeSurface.close();
      } catch (error) {
        surfaceCloseFailure ??= error;
      }
      const result = await api.nativePlayback.close(owner);
      if (surfaceCloseFailure) throw surfaceCloseFailure;
      return result;
    },
  },
});
