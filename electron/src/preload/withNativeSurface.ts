import type { IElectronAPI } from '../../../src/renderer';
import { createSurfaceBridge } from './nativeSurfaceBridge';
export const nativeSurface = createSurfaceBridge();
let surfaceCloseFailure: unknown;
export const withSurface = (api: IElectronAPI): IElectronAPI => {
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
      apply: async (intent) => {
        nativeSurface.expect(intent.generation, intent.seekId);
        await api.nativePlayback.apply(intent);
      },
      close: async (closingOwner) => {
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
