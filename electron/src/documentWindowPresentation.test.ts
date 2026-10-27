import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import {
  registerDocumentWindowTitle,
  updateDocumentWindowTitle,
  presentDocumentWindow,
} from './documentWindowPresentation';
const fixture = (): {
  window: BrowserWindow;
  emitter: EventEmitter;
  setTitle: ReturnType<typeof vi.fn>;
} => {
  const emitter = new EventEmitter();
  const setTitle = vi.fn();
  // Only the Electron methods exercised by the presentation adapter are modeled.
  const window = Object.assign(emitter, {
    setTitle,
    isDestroyed: () => false,
    isMinimized: () => false,
    showInactive: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
  }) as unknown as BrowserWindow;
  return { window, emitter, setTitle };
};
describe('document window role titles', () => {
  it('keeps main and Timeline distinguishable through HTML title updates and reloads', () => {
    const main = fixture();
    const timeline = fixture();
    registerDocumentWindowTitle(main.window, '再生画面');
    registerDocumentWindowTitle(timeline.window, 'タイムライン');
    updateDocumentWindowTitle(main.window, 'Synthetic package - SporTagLytics');
    expect(main.setTitle).toHaveBeenLastCalledWith(
      '再生画面 — Synthetic package - SporTagLytics',
    );
    const event = { preventDefault: vi.fn() };
    for (const target of [main, timeline])
      target.emitter.emit('page-title-updated', event, 'SporTagLytics');
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(main.setTitle).toHaveBeenLastCalledWith('再生画面 — SporTagLytics');
    expect(timeline.setTitle).toHaveBeenLastCalledWith(
      'タイムライン — SporTagLytics',
    );
  });
  it('does not add a role to unrelated windows or change focus for title updates', () => {
    const plain = fixture();
    updateDocumentWindowTitle(plain.window, 'Playlist document');
    expect(plain.setTitle).toHaveBeenLastCalledWith('Playlist document');
    expect(plain.window.focus).not.toHaveBeenCalled();
  });
  it('ignores stale presentation after a window has been destroyed', () => {
    const { window, setTitle } = fixture();
    vi.spyOn(window, 'isDestroyed').mockReturnValue(true);
    presentDocumentWindow(window, true);
    updateDocumentWindowTitle(window, 'late');
    expect(setTitle).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
  });
});
