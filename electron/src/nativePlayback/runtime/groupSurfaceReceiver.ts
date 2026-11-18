import { Buffer } from 'node:buffer';
import {
  exactKeys,
  integerValue,
  objectValue,
} from '../../../../src/shared/validation/jsonValues';
import {
  nativeGroupFrameIdentityKeys,
  parseNativeGroupFrameIdentity,
} from '../../../../src/types/ipc/nativeGroupSurface';
import type { NativeGroupFrameIdentity } from '../../../../src/types/ipc/nativeGroupSurface';

export interface NativeGroupSurfacePacket extends NativeGroupFrameIdentity {
  readonly handle: Buffer;
  readonly surfaceID: number;
  readonly surfaceHeight?: 720;
}
export interface NativeGroupReceiver {
  open(name: string): void;
  setPeer(pid: number): void;
  poll(): NativeGroupSurfacePacket | null;
  drawn(id: number): void;
  release(id: number): void;
  request(): void;
  count(): number;
  close(): void;
}
export const parseNativeGroupSurfacePacket = (
  raw: unknown,
): NativeGroupSurfacePacket | null => {
  if (raw === null) return null;
  const value = objectValue(raw);
  const small = Object.prototype.hasOwnProperty.call(value, 'surfaceHeight');
  exactKeys(value, [...nativeGroupFrameIdentityKeys, 'handle', 'surfaceID', ...(small ? ['surfaceHeight'] : [])]);
  if (small && value.surfaceHeight !== 720) throw Error('NATIVE_GROUP_RECEIVER_LAYOUT');
  if (
    !Buffer.isBuffer(value.handle) ||
    value.handle.length !== 8 ||
    (value.content !== 1 && value.content !== 2)
  )
    throw Error('NATIVE_GROUP_RECEIVER_PACKET');
  const metadata = Object.fromEntries(
    nativeGroupFrameIdentityKeys.map((key) => [key, value[key]]),
  );
  return {
    ...parseNativeGroupFrameIdentity({
      ...metadata,
      content: value.content === 1 ? 'image' : 'blank',
    }),
    handle: value.handle,
    ...(small ? { surfaceHeight: 720 as const } : {}),
    surfaceID: integerValue(value.surfaceID, 1, 4294967295),
  };
};

/** Method presence establishes ABI shape only. The caller must first validate
 * the native resource manifest/hash/signature and helper group capability. */
export const bindNativeGroupReceiver = (raw: unknown): NativeGroupReceiver => {
  const module = objectValue(raw);
  const names = [
    'openGroupV2',
    'groupSetPeer',
    'groupPoll',
    'groupDrawn',
    'groupRelease',
    'groupRequest',
    'groupCount',
    'groupClose',
  ];
  const functions = new Map<string, (args: readonly unknown[]) => unknown>();
  for (const name of names) {
    const method = module[name];
    if (typeof method !== 'function')
      throw Error('NATIVE_GROUP_RECEIVER_UNSUPPORTED');
    functions.set(name, (args): unknown => Reflect.apply(method, raw, args));
  }
  const call = (name: string, args: readonly unknown[] = []): unknown => {
    const method = functions.get(name);
    if (!method) throw Error('NATIVE_GROUP_RECEIVER_UNSUPPORTED');
    return method(args);
  };
  const command = (name: string, args: readonly unknown[] = []): void => {
    if (call(name, args) !== null)
      throw Error('NATIVE_GROUP_RECEIVER_RESPONSE');
  };
  let service: string | null = null;
  let attempted = false;
  let closeAttempted = false,
    closeError: unknown;
  const token = (): string => {
    if (service === null) throw Error('NATIVE_GROUP_RECEIVER_NOT_OPEN');
    return service;
  };
  return {
    open: (name) => {
      if (attempted) throw Error('NATIVE_GROUP_RECEIVER_OPEN_ATTEMPTED');
      attempted = true;
      service = name;
      command('openGroupV2', [name]);
    },
    setPeer: (pid) =>
      command('groupSetPeer', [token(), integerValue(pid, 1, 2147483647)]),
    poll: () => parseNativeGroupSurfacePacket(call('groupPoll', [token()])),
    drawn: (id) => command('groupDrawn', [token(), integerValue(id, 1)]),
    release: (id) => command('groupRelease', [token(), integerValue(id, 1)]),
    request: () => command('groupRequest', [token()]),
    count: () => integerValue(call('groupCount', [token()]), 0, 6),
    close: () => {
      if (closeAttempted) {
        if (closeError) throw closeError;
        return;
      }
      if (service !== null) {
        closeAttempted = true;
        try {
          command('groupClose', [service]);
          service = null;
        } catch (error) {
          closeError = error;
          throw error;
        }
      }
    },
  };
};
export const loadNativeGroupReceiver = (
  verifiedPath: string,
): NativeGroupReceiver => {
  const module: unknown = require(verifiedPath);
  return bindNativeGroupReceiver(module);
};
