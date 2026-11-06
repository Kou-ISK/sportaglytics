import { expect, it, vi } from 'vitest';
import { registerCommandLeftIpc } from './commandLeftIpc';
import { nativeCommandLeftChannels as channels } from '../../../src/types/ipc/nativeCommandLeft';
import type { MainCommandInput } from './commandLeftMain';
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw?: unknown) => unknown>(),
  window: {} as object, valid: true,
}));
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (event: unknown, raw?: unknown) => unknown) => mocks.handlers.set(name, fn), on: vi.fn() } }));
vi.mock('../ipc/windowSenderGuards', () => ({ getValidatedEventSenderWindow: () => mocks.valid ? mocks.window : null }));
vi.mock('../packageSessionRegistry', () => ({ getPackageSessionForWindow: () => ({ packageBound: true, mainWindow: mocks.window }) }));
const main = { start: () => true, arm: vi.fn(() => 1), claim: vi.fn(() => 'active'),
  apply: vi.fn(async () => {}), retire: vi.fn(() => true), revoke: vi.fn(() => 'revoked'),
  acknowledge: vi.fn(), disarm: vi.fn(), dispose: vi.fn() } satisfies MainCommandInput;
registerCommandLeftIpc(main);
const call = async (name: string, raw?: unknown): Promise<unknown> => {
  const handler = mocks.handlers.get(name); if (!handler) throw Error('missing');
  return handler({}, raw);
};
it('rejects untrusted sender before accessing any operation', async () => {
  mocks.valid = false;
  for (const channel of [channels.ready, channels.claim, channels.apply, channels.retire, channels.revoke])
    await expect(call(channel, {})).rejects.toThrow('NATIVE_UNAUTHORIZED');
  mocks.valid = true;
});
it('accepts only narrow gesture payloads and delegates to Main', async () => {
  expect(await call(channels.ready)).toBe(1);
  expect(await call(channels.claim, { gesture: 1, epoch: 2 })).toBe('active');
  await expect(call(channels.claim, { gesture: 1, epoch: 2, path: '/foreign' })).rejects.toThrow();
  await expect(call(channels.retire, { gesture: 0, epoch: 2 })).rejects.toThrow();
  expect(await call(channels.revoke, 2)).toBe('revoked');
});
it('revalidates the sender after waiting for signed startup', async () => {
  const startup = Promise.withResolvers<MainCommandInput | null>();
  registerCommandLeftIpc(startup.promise);
  const result = call(channels.ready);
  mocks.valid = false; startup.resolve(main);
  await expect(result).rejects.toThrow('NATIVE_UNAUTHORIZED');
  mocks.valid = true; registerCommandLeftIpc(main);
});
