import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
import { awaitPackageHistoryRead } from './packageHistoryRead';
import type { PackageOpenOptions } from './legacyPackageMigrationService';
import {
  reservePackageSession,
  releasePackageOpenReservation,
  getPackageSessionForPackagePath,
} from '../packageSessionRegistry';
import type { BrowserWindow } from 'electron';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  prepare: vi.fn(),
  location: vi.fn(),
  recent: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => '/synthetic', addRecentDocument: mocks.recent },
}));
vi.mock('./registerHandleWithAliases', () => ({
  registerHandleWithAliases: (
    name: string,
    _aliases: string[],
    handler: (event: unknown, ...args: unknown[]) => unknown,
  ) => mocks.handlers.set(name, handler),
}));
vi.mock('./windowSenderGuards', () => ({
  getValidatedEventSenderWindow: (event: unknown) => event,
}));
vi.mock('./legacyPackageMigrationService', () => ({
  preparePackageForOpen: mocks.prepare,
}));
vi.mock('./packageMigrationIndex', () => ({ PackageMigrationIndex: class {} }));
vi.mock('./packageOpenDialogs', () => ({
  choosePackageContent: vi.fn(),
  showPackageRecovery: vi.fn(),
}));
vi.mock('../liveCapture/captureRegistry', () => ({
  isPackageCaptureActive: () => false,
}));
vi.mock('../menuBar', () => ({ refreshAppMenu: vi.fn() }));
vi.mock('../mediaReferences/packageLocationRegistry', () => ({
  registerPackageLocation: mocks.location,
}));
import { registerPackageOpenHandlers } from './packageOpenHandlers';

let nextWindow = 0;
const owner = () =>
  Object.assign(new EventEmitter(), {
    id: ++nextWindow,
    isDestroyed: () => false,
    webContents: Object.assign(new EventEmitter(), {
      isDestroyed: () => false,
      send: vi.fn(),
    }),
  });
const invoke = async (
  name: string,
  event: unknown,
  ...args: unknown[]
): Promise<unknown> => {
  const handler = mocks.handlers.get(name);
  if (!handler) throw new Error('missing handler');
  return handler(event, ...args);
};
beforeEach(() => {
  vi.clearAllMocks();
  registerPackageOpenHandlers();
});

it.each(['reload', 'crash', 'closed'])(
  'abandons %s during history I/O and removes lifecycle listeners before retry',
  async (action) => {
    const window = owner();
    const contents = window.webContents;
    // This EventEmitter supplies the lifecycle/identity surface used by the registry; no native Electron window is created.
    const nativeWindow = window as unknown as BrowserWindow;
    reservePackageSession(nativeWindow, '/sample.stpkg');
    let complete: (value: string[]) => void = () => undefined;
    mocks.prepare.mockImplementation(
      async (_path: string, options: PackageOpenOptions) => {
        options.historyRead?.directoryWaiting?.(true);
        try {
          await awaitPackageHistoryRead(
            () =>
              new Promise<string[]>((resolve) => {
                complete = resolve;
              }),
            options.historyRead?.signal,
          );
        } finally {
          options.historyRead?.directoryWaiting?.(false);
        }
        return {
          status: 'ready',
          packagePath: '/sample.stpkg',
          migrated: false,
          reused: false,
        };
      },
    );
    const opened = invoke(
      'package:prepare-open',
      window,
      '/sample.stpkg',
      'old',
    );
    const rejected = expect(opened).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
    await Promise.resolve();
    window.webContents.emit('did-start-navigation', {
      isMainFrame: false,
      isSameDocument: false,
    });
    expect(await invoke('package:cancel-open', owner(), 'old')).toBe(false);
    if (action === 'reload')
      window.webContents.emit('did-start-navigation', {
        isMainFrame: true,
        isSameDocument: false,
      });
    else if (action === 'crash') window.webContents.emit('render-process-gone');
    else {
      Object.defineProperty(window, 'webContents', {
        configurable: true,
        get: () => {
          throw new TypeError('Object has been destroyed');
        },
      });
      window.emit('closed');
    }
    await rejected;
    complete([]);
    await Promise.resolve();
    expect(mocks.location).not.toHaveBeenCalled();
    expect(mocks.recent).not.toHaveBeenCalled();
    expect(window.listenerCount('closed')).toBe(0);
    expect(contents.listenerCount('did-start-navigation')).toBe(0);
    expect(contents.listenerCount('render-process-gone')).toBe(0);
    expect(getPackageSessionForPackagePath('/sample.stpkg')).toBeNull();
    Object.defineProperty(window, 'webContents', {
      configurable: true,
      value: contents,
    });
    reservePackageSession(nativeWindow, '/sample.stpkg');
    mocks.prepare.mockResolvedValue({
      status: 'ready',
      packagePath: '/sample.stpkg',
      migrated: false,
      reused: false,
    });
    await expect(
      invoke('package:prepare-open', window, '/sample.stpkg', 'next'),
    ).resolves.toMatchObject({ status: 'ready' });
    expect(
      releasePackageOpenReservation(nativeWindow, '/sample.stpkg', 'next'),
    ).toBe(true);
  },
);

it('rejects unknown senders and malformed request IDs before preparing', async () => {
  await expect(
    invoke('package:prepare-open', null, '/sample.stpkg', 'valid'),
  ).rejects.toThrow('sender');
  await expect(
    invoke('package:prepare-open', owner(), '/sample.stpkg', '../invalid'),
  ).rejects.toThrow('request');
  await expect(invoke('package:cancel-open', owner(), {})).rejects.toThrow(
    'Invalid',
  );
  expect(mocks.prepare).not.toHaveBeenCalled();
});

it('releases a ready native reservation if the renderer reloads before binding', async () => {
  const window = owner();
  // Minimal native-window surface, as in the lifecycle cases above.
  const nativeWindow = window as unknown as BrowserWindow;
  reservePackageSession(nativeWindow, '/handoff.stpkg');
  mocks.prepare.mockResolvedValue({
    status: 'ready',
    packagePath: '/handoff.stpkg',
    migrated: false,
    reused: false,
  });
  await invoke('package:prepare-open', window, '/handoff.stpkg', 'ready');
  expect(getPackageSessionForPackagePath('/handoff.stpkg')).not.toBeNull();
  window.webContents.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: false,
  });
  expect(getPackageSessionForPackagePath('/handoff.stpkg')).toBeNull();
  expect(window.webContents.listenerCount('did-start-navigation')).toBe(0);
});
