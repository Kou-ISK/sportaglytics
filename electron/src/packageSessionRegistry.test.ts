import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import {
  bindPackageSession,
  createPackageSession,
  focusPackageSession,
  getEmptyPackageSession,
  getPackageSessionForPackagePath,
  getPackageSessionForSender,
  registerAuxiliaryWindow,
  releasePackageSession,
  reservePackageSession,
  claimPackageOpenReservation,
  releasePackageOpenReservation,
} from './packageSessionRegistry';

const createWindow = (id: string): BrowserWindow =>
  // Minimal native-window surface for lifecycle/ownership tests.
  Object.assign(new EventEmitter(), {
    id,
    webContents: Object.assign(new EventEmitter(), { id }),
    isDestroyed: () => false,
  }) as unknown as BrowserWindow;

const createDestroyedWindow = (id: string): BrowserWindow =>
  ({
    id,
    get webContents(): never {
      throw new TypeError('Object has been destroyed');
    },
    isDestroyed: () => true,
  }) as unknown as BrowserWindow;

describe('package session registry', () => {
  it('releases only the claimed unbound reservation and preserves a later claim or bound document', () => {
    const window = createWindow('native-request-owner');
    reservePackageSession(window, '/samples/native.stpkg');
    expect(
      claimPackageOpenReservation(window, '/samples/native.stpkg', 'old'),
    ).toBe(true);
    const oldDeparture = window.webContents.listeners(
      'did-start-navigation',
    )[0];
    claimPackageOpenReservation(window, '/samples/native.stpkg', 'new');
    oldDeparture({ isMainFrame: true, isSameDocument: false });
    expect(
      releasePackageOpenReservation(window, '/samples/native.stpkg', 'old'),
    ).toBe(false);
    expect(
      getPackageSessionForPackagePath('/samples/native.stpkg'),
    ).not.toBeNull();
    expect(
      releasePackageOpenReservation(window, '/samples/native.stpkg', 'new'),
    ).toBe(true);
    reservePackageSession(window, '/samples/native.stpkg');
    expect(releasePackageSession(window, '/samples/native.stpkg', 'old')).toBe(
      false,
    );
    expect(
      getPackageSessionForPackagePath('/samples/native.stpkg'),
    ).not.toBeNull();
    claimPackageOpenReservation(window, '/samples/native.stpkg', 'bound');
    bindPackageSession(window, '/samples/native.stpkg', 'bound');
    expect(
      releasePackageOpenReservation(window, '/samples/native.stpkg', 'bound'),
    ).toBe(false);
    expect(
      releasePackageSession(window, '/samples/native.stpkg', 'bound'),
    ).toBe(true);
  });
  it('does not let an obsolete request release a later binding of the same window and path', () => {
    const main = createWindow('generation-owner');
    const session = bindPackageSession(
      main,
      '/samples/generations.stpkg',
      'first',
    );
    bindPackageSession(main, '/samples/generations.stpkg', 'second');
    expect(
      releasePackageSession(main, '/samples/generations.stpkg', 'first'),
    ).toBe(false);
    expect(releasePackageSession(main, '/samples/generations.stpkg')).toBe(
      false,
    );
    expect(session?.packageBound).toBe(true);
    expect(
      releasePackageSession(main, '/samples/generations.stpkg', 'second'),
    ).toBe(true);
    expect(session?.packagePath).toBeNull();
  });
  it('binds a canonical package path and detects duplicate sessions', () => {
    const mainA = createWindow('main-a');
    const mainB = createWindow('main-b');
    const sessionA = createPackageSession(mainA);

    expect(bindPackageSession(mainA, './matches/../matches/a.stpkg')).toBe(
      sessionA,
    );
    expect(getPackageSessionForPackagePath('matches/a.stpkg')).toBe(sessionA);
    expect(bindPackageSession(mainB, 'matches/a.stpkg')).toBe(sessionA);
  });

  it('resolves auxiliary window senders to their owning session', () => {
    const main = createWindow('main-owner');
    const timeline = createWindow('timeline-owner');
    const session = createPackageSession(main);

    registerAuxiliaryWindow(session, timeline);

    expect(getPackageSessionForSender(timeline.webContents)).toBe(session);
    expect(getPackageSessionForSender({ id: 'unknown' })).toBeNull();
  });

  it('ignores destroyed main and auxiliary windows while resolving a sender', () => {
    const session = createPackageSession(
      createDestroyedWindow('destroyed-main'),
    );
    registerAuxiliaryWindow(
      session,
      createDestroyedWindow('destroyed-timeline'),
    );

    expect(getPackageSessionForSender({ id: 'late-ipc' })).toBeNull();
  });

  it('reserves a path before renderer loading and releases failed reservations', () => {
    const main = createWindow('reserved-main');
    const session = reservePackageSession(main, '/tmp/queued/match.stpkg');

    expect(session.packagePath).toBe(
      process.platform === 'win32'
        ? resolve('/tmp/queued/match.stpkg').toLowerCase()
        : resolve('/tmp/queued/match.stpkg'),
    );
    expect(getEmptyPackageSession()).not.toBe(session);
    expect(
      reservePackageSession(
        createWindow('duplicate-main'),
        '/tmp/queued/match.stpkg',
      ),
    ).toBe(session);

    expect(releasePackageSession(main, '/tmp/queued/match.stpkg')).toBe(true);
    expect(session.packagePath).toBeNull();
  });

  it('restores and focuses an existing package window', () => {
    const restore = vi.fn();
    const show = vi.fn();
    const focus = vi.fn();
    const main = {
      id: 'focus-main',
      webContents: { id: 'focus-main' },
      isDestroyed: () => false,
      isMinimized: () => true,
      isVisible: () => false,
      restore,
      show,
      focus,
    } as unknown as BrowserWindow;
    const session = createPackageSession(main);

    focusPackageSession(session);

    expect(restore).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not reserve a package or accept auxiliary IPC for a destroyed owner', () => {
    let destroyed = false;
    const main = createWindow('closing-owner');
    main.isDestroyed = () => destroyed;
    const session = reservePackageSession(main, 'matches/reopen.stpkg');
    const auxiliary = createWindow('closing-auxiliary');
    registerAuxiliaryWindow(session, auxiliary);
    destroyed = true;

    expect(getPackageSessionForPackagePath('matches/reopen.stpkg')).toBeNull();
    expect(getPackageSessionForSender(auxiliary.webContents)).toBeNull();
    const next = createWindow('reopened-owner');
    expect(bindPackageSession(next, 'matches/reopen.stpkg')?.mainWindow).toBe(
      next,
    );
  });
});

it('routes capture controls to the package without closing its independent recording owner', async () => {
  const {
    setPackageWindowContext,
    getPackageSessionForWindow,
    closePackageSessionWindows,
    removePackageSession,
  } = await import('./packageSessionRegistry');
  const main = createWindow('capture-package');
  const owner = createWindow('capture-controls');
  const session = createPackageSession(main);
  setPackageWindowContext(owner, session);
  expect(getPackageSessionForSender(owner.webContents)).toBe(session);
  expect(getPackageSessionForWindow(owner)).toBe(session);
  expect(session.auxiliaryWindows.has(owner)).toBe(false);
  expect(() => closePackageSessionWindows(session)).not.toThrow();
  removePackageSession(session);
  expect(getPackageSessionForSender(owner.webContents)).toBeNull();
  expect(getPackageSessionForWindow(owner)).toBeNull();
});
