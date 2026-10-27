import { parseNativePlaybackFailure } from '../../../src/types/ipc/nativePlaybackFailure';
import type { IElectronAPI } from '../../../src/renderer';
import {
  nativePlaybackChannels as channels,
  parseNativePlaybackAvailability,
  parseNativePlaybackOwner,
  parseNativePlaybackSnapshot,
  parseNativePlaybackClosed,
} from '../../../src/types/ipc/nativePlayback';
import {
  objectValue,
  exactKeys,
  integerValue,
} from '../../../src/shared/validation/jsonValues';
interface Transport {
  acknowledge: (value: {
    owner: import('../../../src/types/ipc/nativePlayback').NativePlaybackOwner;
    delivery: number;
  }) => void;
  subscribe: (listener: (value: unknown) => void) => () => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}
export const createNativePlaybackBridge = (
  transport: Transport,
): IElectronAPI['nativePlayback'] => {
  let subscription: {
    owner: import('../../../src/types/ipc/nativePlayback').NativePlaybackOwner;
    listener: (
      value:
        | import('../../../src/types/ipc/nativePlayback').NativePlaybackSnapshot
        | null,
    ) => void;
  } | null = null;
  // Keep one document-lifetime receiver to ACK in-flight messages after a
  // controller releases its listener. No raw IPC event reaches the Renderer.
  transport.subscribe((raw) => {
    let notice: {
      owner: import('../../../src/types/ipc/nativePlayback').NativePlaybackOwner;
      delivery: number;
      snapshot:
        | import('../../../src/types/ipc/nativePlayback').NativePlaybackSnapshot
        | null;
    };
    try {
      const value = objectValue(raw);
      exactKeys(value, ['owner', 'delivery', 'snapshot']);
      const owner = parseNativePlaybackOwner(value.owner);
      const delivery = integerValue(value.delivery, 1, Number.MAX_SAFE_INTEGER);
      let snapshot = null;
      try {
        snapshot = parseNativePlaybackSnapshot(value.snapshot);
      } catch {
        /* Fail the matching owner below. */
      }
      notice = { owner, delivery, snapshot };
    } catch {
      subscription?.listener(null);
      return;
    }
    try {
      if (
        subscription &&
        subscription.owner.generation === notice.owner.generation &&
        subscription.owner.sourceKey === notice.owner.sourceKey
      )
        subscription.listener(notice.snapshot);
    } finally {
      transport.acknowledge({ owner: notice.owner, delivery: notice.delivery });
    }
  });
  return {
    reportFailure: async (owner, failure) => {
      await transport.invoke(channels.reportFailure, {
        owner: parseNativePlaybackOwner(owner),
        failure: parseNativePlaybackFailure(failure),
      });
    },
    onSnapshot: (rawOwner, listener) => {
      if (subscription) throw Error('NATIVE_ALREADY_SUBSCRIBED');
      const value = { owner: parseNativePlaybackOwner(rawOwner), listener };
      subscription = value;
      return () => {
        if (subscription === value) subscription = null;
      };
    },
    inspect: async () =>
      parseNativePlaybackAvailability(await transport.invoke(channels.inspect)),
    open: async (owner) => {
      await transport.invoke(channels.open, owner);
    },
    apply: async (intent) => {
      await transport.invoke(channels.apply, intent);
    },
    observe: async (owner) =>
      parseNativePlaybackSnapshot(
        await transport.invoke(channels.observe, owner),
      ),
    close: async (owner) =>
      parseNativePlaybackClosed(await transport.invoke(channels.close, owner)),
  };
};
