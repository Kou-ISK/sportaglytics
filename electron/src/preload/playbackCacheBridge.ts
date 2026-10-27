import type { IElectronAPI } from '../../../src/renderer';
import {
  playbackCacheChannels as channels,
  parsePlaybackCacheCandidate,
  parsePlaybackCacheSnapshot,
} from '../../../src/types/ipc/playbackCache';

interface Transport {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}
/** Main is the response authority; the narrow public type has no arbitrary IPC. */
export const createPlaybackCacheBridge = (
  transport: Transport,
): IElectronAPI['playbackCache'] => ({
  inspect: async () =>
    parsePlaybackCacheSnapshot(await transport.invoke(channels.inspect)),
  prepare: async (request) => {
    await transport.invoke(channels.prepare, request);
  },
  reuse: async (request) => {
    await transport.invoke(channels.reuse, request);
  },
  cancel: async (request) => {
    await transport.invoke(channels.cancel, request);
  },
  cleanup: async (request) => {
    await transport.invoke(channels.cleanup, request);
  },
  candidate: async (request) =>
    parsePlaybackCacheCandidate(
      await transport.invoke(channels.candidate, request),
    ),
  selected: async (request) => {
    await transport.invoke(channels.selected, request);
  },
});
