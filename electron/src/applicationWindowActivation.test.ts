import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  removeListener: vi.fn(),
  getAllWindows: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { on: mocks.on, removeListener: mocks.removeListener },
  BrowserWindow: { getAllWindows: mocks.getAllWindows },
}));
import { registerApplicationWindowActivation } from './applicationWindowActivation';

describe('application window activation', () => {
  it.each(['hidden', 'minimized', 'destroyed'])(
    'ignores a late focus event for a %s window',
    (state) => {
      const focused = {
        isDestroyed: () => state === 'destroyed',
        isVisible: () => state !== 'hidden',
        isMinimized: () => state === 'minimized',
        moveTop: vi.fn(),
      };
      const peer = {
        isDestroyed: () => false,
        isVisible: () => true,
        isMinimized: () => false,
        moveTop: vi.fn(),
      };
      mocks.getAllWindows.mockReturnValue([focused, peer]);
      const dispose = registerApplicationWindowActivation();
      mocks.on.mock.lastCall?.[1]({}, focused);
      expect(focused.moveTop).not.toHaveBeenCalled();
      expect(peer.moveTop).not.toHaveBeenCalled();
      dispose();
    },
  );

  it('does not raise a target hidden while its peers are raised', () => {
    let visible = true;
    const focused = {
      isDestroyed: () => false,
      isVisible: () => visible,
      isMinimized: () => false,
      moveTop: vi.fn(),
    };
    const peer = {
      isDestroyed: () => false,
      isVisible: () => true,
      isMinimized: () => false,
      moveTop: vi.fn(() => {
        visible = false;
      }),
    };
    mocks.getAllWindows.mockReturnValue([focused, peer]);
    const dispose = registerApplicationWindowActivation();
    mocks.on.mock.lastCall?.[1]({}, focused);
    expect(peer.moveTop).toHaveBeenCalledOnce();
    expect(focused.moveTop).not.toHaveBeenCalled();
    dispose();
  });

  it('raises visible peers, keeps the focused window last and avoids recursive activation', () => {
    const calls: string[] = [];
    const make = (
      id: string,
      visible = true,
      minimized = false,
      destroyed = false,
    ) => ({
      isDestroyed: () => destroyed,
      isVisible: () => visible,
      isMinimized: () => minimized,
      moveTop: vi.fn(() => {
        calls.push(id);
        mocks.on.mock.lastCall?.[1]({}, focused);
      }),
    });
    const focused = make('focused'),
      peer = make('peer');
    mocks.getAllWindows.mockReturnValue([
      focused,
      peer,
      make('hidden', false),
      make('minimized', true, true),
      make('closed', true, false, true),
    ]);
    const dispose = registerApplicationWindowActivation();
    mocks.on.mock.lastCall?.[1]({}, focused);
    expect(calls).toEqual(['peer', 'focused']);
    dispose();
    expect(mocks.removeListener).toHaveBeenCalledWith(
      'browser-window-focus',
      mocks.on.mock.lastCall?.[1],
    );
  });
});
