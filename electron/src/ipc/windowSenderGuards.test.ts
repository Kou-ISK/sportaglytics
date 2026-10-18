import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRendererUrl } from '../rendererUrl';
import {
  getValidatedEventSenderWindow,
  isEventFromWindow,
} from './windowSenderGuards';

const electron = vi.hoisted(() => ({ fromWebContents: vi.fn() }));
vi.mock('electron', () => ({ BrowserWindow: electron }));

const fixture = () => {
  const frame = { url: getRendererUrl('/timeline') };
  const sender = {
    mainFrame: frame,
    getURL: () => frame.url,
    isDestroyed: vi.fn(() => false),
  };
  const window = { webContents: sender, isDestroyed: vi.fn(() => false) };
  // Electron supplies the remaining native members; these doubles contain every
  // member used by the guard and let the tests model detached/foreign frames.
  return {
    frame,
    sender,
    window: window as unknown as BrowserWindow,
    event: { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent,
  };
};

beforeEach(() => electron.fromWebContents.mockReset());

describe('IPC sender document and frame boundary', () => {
  it('accepts the main frame of a live app window and preserves owner identity', () => {
    const { window, event } = fixture();
    electron.fromWebContents.mockReturnValue(window);
    expect(getValidatedEventSenderWindow(event)).toBe(window);
    expect(isEventFromWindow(event, window)).toBe(true);
    expect(isEventFromWindow(event, fixture().window)).toBe(false);
  });

  it('rejects child frames even if their URL equals the trusted document', () => {
    const { window, event, frame } = fixture();
    electron.fromWebContents.mockReturnValue(window);
    const childEvent = {
      ...event,
      senderFrame: { ...frame },
    } as IpcMainInvokeEvent;
    expect(getValidatedEventSenderWindow(childEvent)).toBeNull();
    expect(isEventFromWindow(childEvent, window)).toBe(false);
  });

  it('rejects missing, detached, destroyed or foreign documents before granting IPC', () => {
    const { window, event, frame, sender } = fixture();
    electron.fromWebContents.mockReturnValue(window);
    expect(
      getValidatedEventSenderWindow({ ...event, senderFrame: null }),
    ).toBeNull();
    for (const url of [
      'data:text/html,foreign',
      'file:///fixture/foreign.html',
      'https://example.invalid/',
    ]) {
      frame.url = url;
      expect(getValidatedEventSenderWindow(event)).toBeNull();
      expect(isEventFromWindow(event, window)).toBe(false);
    }
    frame.url = getRendererUrl();
    sender.isDestroyed.mockReturnValue(true);
    expect(getValidatedEventSenderWindow(event)).toBeNull();
    sender.isDestroyed.mockReturnValue(false);
    electron.fromWebContents.mockReturnValue(null);
    expect(getValidatedEventSenderWindow(event)).toBeNull();
    const detached = Object.defineProperty({ ...event }, 'senderFrame', {
      get: () => {
        throw new Error('Frame detached');
      },
    });
    expect(getValidatedEventSenderWindow(detached)).toBeNull();
  });
});
