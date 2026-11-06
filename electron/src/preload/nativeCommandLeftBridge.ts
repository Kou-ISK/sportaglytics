import type { IpcRenderer } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import { booleanValue, enumValue, integerValue } from '../../../src/shared/validation/jsonValues';
import { nativeCommandLeftChannels as channels, parseNativeCommandLeftEvent } from '../../../src/types/ipc/nativeCommandLeft';
import { parseNativePlaybackIntent } from '../../../src/types/ipc/nativePlayback';

/** Narrow explicit channels; no raw IPC events or native handles reach Renderer. */
export const createNativeCommandLeftBridge = (ipc: IpcRenderer): NonNullable<IElectronAPI['nativeCommandLeft']> => {
  let subscribed = false;
  return ({
  ready: async () => { const value: unknown = await ipc.invoke(channels.ready); return value === null ? null : integerValue(value, 1); },
  claim: async (gesture, epoch) => enumValue(await ipc.invoke(channels.claim, { gesture: integerValue(gesture, 1), epoch: integerValue(epoch, 1) }), ['active', 'ended', 'invalid']),
  apply: async (gesture, epoch, intent) => { await ipc.invoke(channels.apply, { gesture: integerValue(gesture, 1), epoch: integerValue(epoch, 1), intent: parseNativePlaybackIntent(intent) }); },
  retire: async (gesture, epoch) => booleanValue(await ipc.invoke(channels.retire, { gesture: integerValue(gesture, 1), epoch: integerValue(epoch, 1) })),
  revoke: async (epoch) => enumValue(await ipc.invoke(channels.revoke, integerValue(epoch, 1)), ['revoked', 'already-revoked', 'pending', 'rejected']),
  onEvent: (listener) => {
    if (subscribed) throw Error('NATIVE_COMMAND_ALREADY_SUBSCRIBED');
    subscribed = true;
    const receive = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
      let value: ReturnType<typeof parseNativeCommandLeftEvent> | null;
      try { value = parseNativeCommandLeftEvent(raw); } catch { value = null; }
      let accepted = false;
      try { accepted = listener(value) === true; } catch { /* no successful delivery */ }
      if (value) ipc.send(channels.acknowledgement, { epoch: value.epoch, serial: value.serial, accepted });
    };
    ipc.on(channels.event, receive);
    return () => { ipc.removeListener(channels.event, receive); subscribed = false; };
  },
  onOverflow: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
      let value: number | null;
      try { value = integerValue(raw, 1); } catch { value = null; }
      listener(value);
    };
    ipc.on(channels.overflow, receive);
    return () => { ipc.removeListener(channels.overflow, receive); };
  },
  });
};
