import { expect, it, vi } from 'vitest';
import type { IpcRenderer } from 'electron';
import { createNativeCommandLeftBridge } from './nativeCommandLeftBridge';
import { nativeCommandLeftChannels as channels } from '../../../src/types/ipc/nativeCommandLeft';
const fixture = () => {
  const listeners = new Map<string, (_event: unknown, value: unknown) => void>();
  const invoke = vi.fn(async (channel: string) => channel === channels.ready ? 1 : channel === channels.claim ? 'active' : true);
  const ipc = { invoke,
    send: vi.fn(),
    on: (channel: string, listener: (_event: unknown, value: unknown) => void) => { listeners.set(channel, listener); },
    removeListener: (channel: string) => { listeners.delete(channel); },
  };
  return { bridge: createNativeCommandLeftBridge(ipc as unknown as IpcRenderer), invoke, listeners, send: ipc.send };
};
it('uses narrow channels and validates inputs and responses', async () => {
  const { bridge, invoke } = fixture();
  expect(await bridge.ready()).toBe(1);
  expect(await bridge.claim(2, 1)).toBe('active');
  expect(invoke).toHaveBeenLastCalledWith(channels.claim, { gesture: 2, epoch: 1 });
  await expect(bridge.claim(0, 1)).rejects.toThrow();
  invoke.mockResolvedValueOnce('unexpected');
  await expect(bridge.claim(2, 1)).rejects.toThrow();
});
it('does not expose IPC event objects and reports malformed messages', () => {
  const { bridge, listeners, send } = fixture(); const listener = vi.fn(() => true);
  const unsubscribe = bridge.onEvent(listener);
  const receive = listeners.get(channels.event); if (!receive) throw Error('missing listener');
  const event = { phase: 'down', gesture: 1, serial: 1, epoch: 1, meta: true, shift: false, alt: false, control: false };
  receive({ private: 'not delivered' }, event);
  expect(listener).toHaveBeenCalledWith(event);
  expect(send).toHaveBeenCalledWith(channels.acknowledgement, { epoch: 1, serial: 1, accepted: true });
  receive({}, { ...event, windowNumber: 7 });
  expect(listener).toHaveBeenLastCalledWith(null);
  unsubscribe(); expect(listeners.has(channels.event)).toBe(false);
});
it('rejects multiple consumers and negatively acknowledges a throwing consumer', () => {
  const { bridge, listeners, send } = fixture();
  const unsubscribe = bridge.onEvent(() => { throw Error('consumer failed'); });
  expect(() => bridge.onEvent(() => true)).toThrow('NATIVE_COMMAND_ALREADY_SUBSCRIBED');
  const receive = listeners.get(channels.event); if (!receive) throw Error('missing listener');
  receive({}, { phase: 'up', gesture: 1, serial: 2, epoch: 1, meta: true, shift: false, alt: false, control: false });
  expect(send).toHaveBeenCalledWith(channels.acknowledgement, { epoch: 1, serial: 2, accepted: false });
  unsubscribe();
});
