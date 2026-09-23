import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { sendPackageOpenWhenReady } from './packageOpenDelivery';

const fixture = () => {
  const events = new EventEmitter();
  const window = {
    isDestroyed: vi.fn(() => false),
    webContents: {
      isDestroyed: vi.fn(() => false),
      isLoading: vi.fn(() => true),
      once: (event: 'did-stop-loading', listener: () => void) =>
        events.once(event, listener),
      send: vi.fn(),
    },
  };
  return { window, events };
};

describe('package open delivery', () => {
  it('delivers when loading stops even if did-finish-load already happened', () => {
    const { window, events } = fixture();
    events.emit('did-finish-load');
    sendPackageOpenWhenReady(window, '/sample.stpkg');
    expect(window.webContents.send).not.toHaveBeenCalled();
    events.emit('did-stop-loading');
    events.emit('did-stop-loading');
    expect(window.webContents.send).toHaveBeenCalledExactlyOnceWith(
      'open-package-directory',
      '/sample.stpkg',
    );
  });

  it('waits for a pending load, and delivers immediately to an idle page', () => {
    const { window, events } = fixture();
    sendPackageOpenWhenReady(window, '/first.stpkg');
    events.emit('did-finish-load');
    expect(window.webContents.send).not.toHaveBeenCalled();
    window.webContents.isLoading.mockReturnValue(false);
    events.emit('did-stop-loading');
    sendPackageOpenWhenReady(window, '/second.stpkg');
    expect(window.webContents.send.mock.calls).toEqual([
      ['open-package-directory', '/first.stpkg'],
      ['open-package-directory', '/second.stpkg'],
    ]);
  });

  it.each(['window', 'renderer'] as const)(
    'ignores a closed %s before or during loading',
    (target) => {
      const { window, events } = fixture();
      sendPackageOpenWhenReady(window, '/pending.stpkg');
      if (target === 'window') window.isDestroyed.mockReturnValue(true);
      else window.webContents.isDestroyed.mockReturnValue(true);
      events.emit('did-stop-loading');
      sendPackageOpenWhenReady(window, '/late.stpkg');
      expect(window.webContents.send).not.toHaveBeenCalled();
      expect(events.listenerCount('did-stop-loading')).toBe(0);
    },
  );
});
