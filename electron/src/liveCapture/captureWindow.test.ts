import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => {
  class Window {
    static instances: Window[] = [];
    visible = false;
    minimized = false;
    listeners = new Map<string, (() => void)[]>();
    webContents = { on: vi.fn() };
    constructor() {
      Window.instances.push(this);
    }
    isDestroyed = (): boolean => false;
    show = vi.fn(() => {
      this.visible = true;
    });
    hide = vi.fn(() => {
      this.visible = false;
    });
    restore = vi.fn(() => {
      this.minimized = false;
    });
    isMinimized = (): boolean => this.minimized;
    focus = vi.fn();
    setMenuBarVisibility = vi.fn();
    loadURL = vi.fn(async (): Promise<void> => undefined);
    on = (name: string, handler: () => void): void => {
      this.listeners.set(name, [...(this.listeners.get(name) ?? []), handler]);
    };
    once = this.on;
    emit = (name: string): void => {
      for (const listener of this.listeners.get(name) ?? []) listener();
    };
    // Native close supplies an event, while delayed show does not.
    closeRequest = (): void => {
      for (const listener of this.listeners.get('close') ?? []) {
        Reflect.apply(listener, this, [{ preventDefault: vi.fn() }]);
      }
    };
  }
  return { Window };
});
vi.mock('electron', () => ({
  BrowserWindow: fixture.Window,
  session: {
    fromPartition: () => ({
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
    }),
  },
}));
vi.mock('../rendererUrl', () => ({
  getRendererUrl: () => 'file:///app/index.html#/live-capture',
}));
vi.mock('../windowSecurity', () => ({ applyWindowSecurity: vi.fn() }));
beforeEach(() => {
  vi.resetModules();
  fixture.Window.instances = [];
});

describe('capture controls visibility ownership', () => {
  it('does not reopen an automatically hidden window on ready-to-show', async () => {
    const module = await import('./captureWindow');
    module.openLiveCaptureWindow();
    const window = fixture.Window.instances[0];
    module.hideLiveCaptureWindow();
    window.emit('ready-to-show');
    expect(window.show).not.toHaveBeenCalled();
    window.visible = true;
    window.emit('show');
    expect(window.visible).toBe(false);
  });
  it('keeps controls hidden when an older native show arrives after close', async () => {
    const module = await import('./captureWindow');
    const stop = vi.fn(async (): Promise<void> => undefined);
    module.setCaptureWindowLifecycle({ canClose: () => false, stop });
    module.openLiveCaptureWindow();
    const window = fixture.Window.instances[0];
    window.emit('ready-to-show');
    module.openLiveCaptureWindow();
    window.closeRequest();
    expect(window.visible).toBe(false);
    window.visible = true;
    window.emit('show');
    expect(window.visible).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    module.openLiveCaptureWindow();
    window.emit('show');
    expect(window.visible).toBe(true);
  });

  it('restores only a minimized capture window', async () => {
    const module = await import('./captureWindow');
    module.openLiveCaptureWindow();
    const window = fixture.Window.instances[0];
    module.openLiveCaptureWindow();
    expect(window.restore).not.toHaveBeenCalled();
    window.minimized = true;
    module.openLiveCaptureWindow();
    expect(window.restore).toHaveBeenCalledTimes(1);
    expect(window.visible).toBe(true);
  });
});
