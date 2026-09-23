import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllWindows } = vi.hoisted(() => ({ getAllWindows: vi.fn() }));
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows } }));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: vi.fn(),
}));

import { sendMenuCommand, sendToAllWindows } from './menuCommandDelivery';

const createTarget = () => ({
  isDestroyed: () => false,
  webContents: { isDestroyed: () => false, send: vi.fn() },
});

describe('menu delivery during native window closure', () => {
  beforeEach(() => getAllWindows.mockReset());

  it('continues broadcasting past a window whose renderer has closed', () => {
    const closing = createTarget();
    closing.webContents.isDestroyed = () => true;
    const active = createTarget();
    getAllWindows.mockReturnValue([closing, active]);
    sendToAllWindows('menu-open-package');
    expect(closing.webContents.send).not.toHaveBeenCalled();
    expect(active.webContents.send).toHaveBeenCalledWith('menu-open-package');
  });

  it('does not access webContents of a destroyed window', () => {
    const access = vi.fn(() => {
      throw new Error('unexpected access');
    });
    sendMenuCommand(
      {
        isDestroyed: () => true,
        get webContents() {
          return access();
        },
      },
      'menu-open-package',
    );
    expect(access).not.toHaveBeenCalled();
  });

  it('survives a native close during the webContents getter or send', () => {
    const closing = createTarget();
    closing.webContents.send.mockImplementation(() => {
      throw new Error('Object has been destroyed');
    });
    const closedGetter = {
      isDestroyed: () => false,
      get webContents(): never {
        throw new Error('Object has been destroyed');
      },
    };
    const active = createTarget();
    getAllWindows.mockReturnValue([closing, closedGetter, active]);
    expect(() =>
      sendToAllWindows('menu-set-sync-mode', 'manual'),
    ).not.toThrow();
    expect(active.webContents.send).toHaveBeenCalledWith(
      'menu-set-sync-mode',
      'manual',
    );
  });

  it('does not hide unrelated IPC errors', () => {
    const target = createTarget();
    target.webContents.send.mockImplementation(() => {
      throw new Error('serialization failed');
    });
    expect(() => sendMenuCommand(target, 'menu-open-package')).toThrow(
      'serialization failed',
    );
  });
});
