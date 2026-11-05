// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWorkspaceHotkeys } from './useWorkspaceHotkeys';
const mocks = vi.hoisted(() => ({ controller: null as unknown }));
vi.mock('../../shared/nativePlayback/nativePlaybackRegistry', () => ({
  getNativePlayback: () => mocks.controller,
  subscribeNativePlayback: () => () => {},
}));
const hotkeys = [{ id: 'reverse-playback-6x', label: 'Reverse', key: 'Command+Left' }];
const key = (): KeyboardEvent => new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', metaKey: true, cancelable: true });
const tick = async (): Promise<void> => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(window, 'electronAPI'); mocks.controller = null; });
it('keeps the ordinary shortcut when Main is unavailable', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  mocks.controller = { supportsReverse: () => true, subscribe: () => () => {}, interruptCommandGesture: () => {}, requestedControls: { playing: false, rate: 1 } };
  const api = { ready: vi.fn(async () => { throw Error('unavailable'); }), onEvent: () => () => {}, onOverflow: () => () => {} };
  Object.defineProperty(window, 'electronAPI', { value: { nativeCommandLeft: api }, configurable: true });
  const start = vi.fn();
  const view = renderHook(() => useWorkspaceHotkeys('auto', hotkeys, { 'reverse-playback-6x': start }, {}, vi.fn(), vi.fn()));
  await act(tick); const event = key(); window.dispatchEvent(event);
  expect(start).toHaveBeenCalledOnce(); view.unmount();
});
it('suppresses the duplicate DOM shortcut only after an epoch is armed', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  mocks.controller = { supportsReverse: () => true, subscribe: () => () => {}, interruptCommandGesture: () => {}, requestedControls: { playing: false, rate: 1 } };
  const api = { ready: vi.fn(async () => 1), revoke: vi.fn(async () => 'revoked'),
    onEvent: () => () => {}, onOverflow: () => () => {} };
  Object.defineProperty(window, 'electronAPI', { value: { nativeCommandLeft: api }, configurable: true });
  const start = vi.fn();
  const view = renderHook(() => useWorkspaceHotkeys('auto', hotkeys, { 'reverse-playback-6x': start }, {}, vi.fn(), vi.fn()));
  await act(tick); const event = key(); window.dispatchEvent(event);
  expect(start).not.toHaveBeenCalled(); expect(event.defaultPrevented).toBe(true);
  view.unmount(); await act(tick);
});
it('suppresses Meta release after a native down even if DOM keydown was missing', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  mocks.controller = { supportsReverse: () => true, subscribe: () => () => {}, interruptCommandGesture: () => {}, requestedControls: { playing: false, rate: 1 } };
  const events: { callback?: (value: unknown) => void } = {};
  const api = { ready: vi.fn(async () => 1), revoke: vi.fn(async () => 'revoked'),
    claim: vi.fn(() => new Promise(() => {})),
    onEvent: (callback: (value: unknown) => void) => { events.callback = callback; return () => {}; },
    onOverflow: () => () => {} };
  Object.defineProperty(window, 'electronAPI', { value: { nativeCommandLeft: api }, configurable: true });
  const finish = vi.fn();
  const view = renderHook(() => useWorkspaceHotkeys('auto', hotkeys,
    { 'reverse-playback-6x': vi.fn() }, { 'reverse-playback-6x': finish }, vi.fn(), vi.fn()));
  await act(tick);
  if (!events.callback) throw Error('missing listener');
  act(() => events.callback?.({ phase: 'down', gesture: 1, serial: 1, epoch: 1,
    meta: true, shift: false, alt: false, control: false }));
  const release = new KeyboardEvent('keyup', { key: 'Meta', cancelable: true });
  window.dispatchEvent(release);
  expect(release.defaultPrevented).toBe(true); expect(finish).not.toHaveBeenCalled();
  view.unmount(); await act(tick);
});
it('does not arm midway through a reverse gesture started while Main was loading', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const controller = { supportsReverse: () => true, subscribe: () => () => {}, interruptCommandGesture: () => {},
    requestedControls: { playing: false, rate: 1 } };
  mocks.controller = controller;
  const ready = Promise.withResolvers<number | null>();
  const api = { ready: vi.fn(() => ready.promise), revoke: vi.fn(async () => 'revoked'),
    onEvent: () => () => {}, onOverflow: () => () => {} };
  Object.defineProperty(window, 'electronAPI', { value: { nativeCommandLeft: api }, configurable: true });
  const start = vi.fn(() => { controller.requestedControls = { playing: true, rate: -6 }; });
  const view = renderHook(() => useWorkspaceHotkeys('auto', hotkeys,
    { 'reverse-playback-6x': start }, {}, vi.fn(), vi.fn()));
  await act(tick); window.dispatchEvent(key()); expect(start).toHaveBeenCalledOnce();
  ready.resolve(1); await act(tick);
  expect(api.revoke).toHaveBeenCalledWith(1);
  window.dispatchEvent(key()); expect(start).toHaveBeenCalledTimes(2);
  view.unmount(); await act(tick);
});
it('does not suppress a later plain Left release when Meta keyup was missing', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  mocks.controller = { supportsReverse: () => true, subscribe: () => () => {}, interruptCommandGesture: () => {},
    requestedControls: { playing: false, rate: 1 } };
  const events: { callback?: (value: unknown) => void } = {};
  const api = { ready: vi.fn(async () => 1), revoke: vi.fn(async () => 'revoked'),
    claim: vi.fn(() => new Promise(() => {})),
    onEvent: (callback: (value: unknown) => void) => { events.callback = callback; return () => {}; },
    onOverflow: () => () => {} };
  Object.defineProperty(window, 'electronAPI', { value: { nativeCommandLeft: api }, configurable: true });
  const start = vi.fn(); const finish = vi.fn();
  const keys = [...hotkeys, { id: 'reverse-playback-slow', label: 'Slow', key: 'Left' }];
  const view = renderHook(() => useWorkspaceHotkeys('auto', keys,
    { 'reverse-playback-slow': start }, { 'reverse-playback-slow': finish }, vi.fn(), vi.fn()));
  await act(tick); if (!events.callback) throw Error('missing listener');
  act(() => {
    events.callback?.({ phase: 'down', gesture: 1, serial: 1, epoch: 1, meta: true, shift: false, alt: false, control: false });
    events.callback?.({ phase: 'cancel', gesture: 1, serial: 2, epoch: 1, meta: false, shift: false, alt: false, control: false });
  });
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', cancelable: true }));
  expect(start).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledOnce();
  view.unmount(); await act(tick);
});
it('buffers an input that arrives before the ready reply and delivers it after the epoch is installed', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  mocks.controller = { supportsReverse: () => true, subscribe: () => () => {}, interruptCommandGesture: () => {},
    prepareCommandGesture: async () => true, reserveCommandGesture: () => 1,
    startCommandGesture: async () => 1, hasCommandGesture: () => true,
    requestedControls: { playing: false, rate: 1 } };
  const events: { callback?: (value: unknown) => boolean } = {};
  const ready = Promise.withResolvers<number | null>();
  const api = { ready: vi.fn(() => ready.promise), revoke: vi.fn(async () => 'revoked'),
    claim: vi.fn(async () => 'active'), apply: vi.fn(async () => {}),
    onEvent: (callback: (value: unknown) => boolean) => { events.callback = callback; return () => {}; },
    onOverflow: () => () => {} };
  Object.defineProperty(window, 'electronAPI', { value: { nativeCommandLeft: api }, configurable: true });
  const view = renderHook(() => useWorkspaceHotkeys('auto', hotkeys,
    { 'reverse-playback-6x': vi.fn() }, {}, vi.fn(), vi.fn()));
  await act(tick); if (!events.callback) throw Error('missing listener');
  expect(events.callback({ phase: 'down', gesture: 1, serial: 1, epoch: 1,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(api.claim).not.toHaveBeenCalled();
  ready.resolve(1); await act(tick); expect(api.claim).toHaveBeenCalledWith(1, 1);
  view.unmount(); await act(tick);
});
