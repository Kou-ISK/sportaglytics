import { describe, expect, it, vi } from 'vitest';
import type { IpcRenderer } from 'electron';
import type { RegisterListener } from './listenerStore';
import { createAppBridgeMenuApi } from './appBridgeMenuApi';

describe('createAppBridgeMenuApi', () => {
  it('registers cleanup-capable menu listeners and filters invalid payloads', () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const registerListener: RegisterListener = (channel, callback) => {
      const wrapped = (...args: unknown[]) => callback(...args);
      listeners.set(channel, wrapped);
      return () => {
        listeners.delete(channel);
      };
    };
    const send = vi.fn();
    const bridge = createAppBridgeMenuApi(
      { send } as Pick<IpcRenderer, 'send'> as IpcRenderer,
      registerListener,
    );

    const onToggleLabelMode = vi.fn();
    const unsubscribeToggle = bridge.onToggleLabelMode(onToggleLabelMode);
    listeners.get('menu-toggle-label-mode')?.('invalid');
    listeners.get('menu-toggle-label-mode')?.(true);

    expect(onToggleLabelMode).toHaveBeenCalledTimes(1);
    expect(onToggleLabelMode).toHaveBeenCalledWith(true);

    unsubscribeToggle();
    expect(listeners.has('menu-toggle-label-mode')).toBe(false);

    const onOpenRecentPackage = vi.fn();
    const unsubscribeRecent = bridge.onOpenRecentPackage(onOpenRecentPackage);
    listeners.get('menu-open-recent-package')?.(42);
    listeners.get('menu-open-recent-package')?.('/tmp/package');

    expect(onOpenRecentPackage).toHaveBeenCalledTimes(1);
    expect(onOpenRecentPackage).toHaveBeenCalledWith('/tmp/package');

    unsubscribeRecent();
    expect(listeners.has('menu-open-recent-package')).toBe(false);
  });

  it('forwards recent package updates to ipcRenderer', () => {
    const send = vi.fn();
    const registerListener: RegisterListener = (_channel, _callback) => {
      return () => undefined;
    };
    const bridge = createAppBridgeMenuApi(
      { send } as Pick<IpcRenderer, 'send'> as IpcRenderer,
      registerListener,
    );

    bridge.updateRecentPackages(['/tmp/a', '/tmp/b']);

    expect(send).toHaveBeenCalledWith('recent-packages:update', [
      '/tmp/a',
      '/tmp/b',
    ]);
  });
});
