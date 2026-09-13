import { resolve } from 'node:path';
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
} from './packageSessionRegistry';

const createWindow = (id: string): BrowserWindow => ({
  id,
  webContents: { id },
  isDestroyed: () => false,
}) as unknown as BrowserWindow;

const createDestroyedWindow = (id: string): BrowserWindow => ({
  id,
  get webContents(): never {
    throw new TypeError('Object has been destroyed');
  },
  isDestroyed: () => true,
}) as unknown as BrowserWindow;

describe('package session registry', () => {
  it('binds a canonical package path and detects duplicate sessions', () => {
    const mainA = createWindow('main-a');
    const mainB = createWindow('main-b');
    const sessionA = createPackageSession(mainA);

    expect(bindPackageSession(mainA, './matches/../matches/a.stpkg')).toBe(sessionA);
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
    const session = createPackageSession(createDestroyedWindow('destroyed-main'));
    registerAuxiliaryWindow(session, createDestroyedWindow('destroyed-timeline'));

    expect(getPackageSessionForSender({ id: 'late-ipc' })).toBeNull();
  });

  it('reserves a path before renderer loading and releases failed reservations', () => {
    const main = createWindow('reserved-main');
    const session = reservePackageSession(main, '/tmp/queued/match.stpkg');

    expect(session.packagePath).toBe(process.platform === 'win32' ? resolve('/tmp/queued/match.stpkg').toLowerCase() : resolve('/tmp/queued/match.stpkg'));
    expect(getEmptyPackageSession()).not.toBe(session);
    expect(reservePackageSession(createWindow('duplicate-main'), '/tmp/queued/match.stpkg')).toBe(
      session,
    );

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
});
