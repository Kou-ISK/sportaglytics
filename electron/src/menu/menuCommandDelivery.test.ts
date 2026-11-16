import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllWindows, getFocusedWindow } = vi.hoisted(() => ({ getAllWindows: vi.fn(), getFocusedWindow: vi.fn() }));
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows, getFocusedWindow } }));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: vi.fn(),
}));

import { getPackageSessionForWindow } from '../packageSessionRegistry';
import { sendToPackageMainWindow, sendMenuCommand, sendToAllWindows } from './menuCommandDelivery';

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


describe('sync menu package ownership', () => {
  beforeEach(() => {
    getAllWindows.mockReset(); getFocusedWindow.mockReset();
    vi.mocked(getPackageSessionForWindow).mockReset();
  });
  it('routes a focused child to its main player instead of the child or another package', () => {
    const main = createTarget(), child = createTarget(), other = createTarget();
    getAllWindows.mockReturnValue([other, child, main]); getFocusedWindow.mockReturnValue(child);
    vi.mocked(getPackageSessionForWindow).mockImplementation((window) => window === child || window === main
      ? { mainWindow: main } : { mainWindow: other });
    sendToPackageMainWindow('menu-set-sync-mode', 'manual');
    expect(main.webContents.send).toHaveBeenCalledWith('menu-set-sync-mode', 'manual');
    expect(child.webContents.send).not.toHaveBeenCalled(); expect(other.webContents.send).not.toHaveBeenCalled();
  });
  it('does not target another package when the focused window has no package', () => {
    const unrelated = createTarget(), main = createTarget();
    getAllWindows.mockReturnValue([main, unrelated]); getFocusedWindow.mockReturnValue(unrelated);
    vi.mocked(getPackageSessionForWindow).mockImplementation((window) => window === main ? { mainWindow: main } : null);
    sendToPackageMainWindow('menu-reset-sync');
    expect(main.webContents.send).not.toHaveBeenCalled(); expect(unrelated.webContents.send).not.toHaveBeenCalled();
  });
  it('uses only an unambiguous package when a native menu temporarily has no focused window', () => {
    const main = createTarget(), other = createTarget(); getFocusedWindow.mockReturnValue(null);
    getAllWindows.mockReturnValue([main]);
    vi.mocked(getPackageSessionForWindow).mockImplementation((window) => ({ mainWindow: window }));
    sendToPackageMainWindow('menu-resync-audio'); expect(main.webContents.send).toHaveBeenCalledOnce();
    getAllWindows.mockReturnValue([main, other]);
    sendToPackageMainWindow('menu-resync-audio');
    expect(main.webContents.send).toHaveBeenCalledOnce(); expect(other.webContents.send).not.toHaveBeenCalled();
  });
});
