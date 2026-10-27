import { expect, it, vi } from 'vitest';
import { registerPackageSessionHandlers } from './packageSessionHandlers';

const handlers = vi.hoisted(
  () => new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
);
vi.mock('electron', () => ({
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, ...args: unknown[]) => unknown,
    ) => handlers.set(name, handler),
  },
}));
vi.mock('./windowSenderGuards', () => ({
  getValidatedEventSenderWindow: (event: unknown) => event,
}));
vi.mock('./packageUpdateLeases', () => ({ isPackageUpdating: () => false }));

it('validates request IDs and isolates release to the binding owner and generation', () => {
  registerPackageSessionHandlers();
  const bind = handlers.get('package-session:bind');
  const release = handlers.get('package-session:release');
  if (!bind || !release) throw new Error('missing handlers');
  const a = { isDestroyed: () => false };
  const b = { isDestroyed: () => false };
  const path = '/synthetic/ipc-generations.stpkg';
  expect(bind(null, path, 'a')).toBe(false);
  expect(bind(a, path, {})).toBe(false);
  expect(bind(a, path, 'old')).toBe(true);
  expect(bind(a, path, 'new')).toBe(true);
  expect(release(b, path, 'new')).toBe(false);
  expect(release(a, path, {})).toBe(false);
  expect(release(a, path, 'old')).toBe(false);
  expect(release(a, path)).toBe(false);
  expect(release(a, path, 'new')).toBe(true);
  expect(bind(a, path)).toBe(true);
  expect(release(a, path)).toBe(true);
});
