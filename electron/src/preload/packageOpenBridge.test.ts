import { expect, it, vi } from 'vitest';
import { createPackageOpenBridge } from './packageOpenBridge';

const fixture = () => {
  let receive: ((event: unknown, path: unknown) => void) | undefined;
  const bridge = createPackageOpenBridge({
    on: (_channel, callback) => {
      receive = callback;
    },
  });
  return { bridge, emit: (path: unknown) => receive?.({}, path) };
};

it('retains an OS open arriving before React subscribes and consumes it once', async () => {
  const f = fixture();
  f.emit('/sample.stpkg');
  const first = vi.fn();
  const off = f.bridge.onPackageDirectoryOpen(first);
  expect(first).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(first).toHaveBeenCalledExactlyOnceWith('/sample.stpkg');
  off();
  const next = vi.fn();
  f.bridge.onPackageDirectoryOpen(next);
  await Promise.resolve();
  expect(next).not.toHaveBeenCalled();
});

it('delivers to the current StrictMode owner rather than a removed callback', async () => {
  const f = fixture();
  f.emit('/sample.stpkg');
  const old = vi.fn();
  const off = f.bridge.onPackageDirectoryOpen(old);
  off();
  const current = vi.fn();
  f.bridge.onPackageDirectoryOpen(current);
  await Promise.resolve();
  expect(old).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledExactlyOnceWith('/sample.stpkg');
});

it('retains opens between setup and playback subscriptions and honors ownership cleanup', async () => {
  const f = fixture();
  const callback = vi.fn();
  const off = f.bridge.onPackageDirectoryOpen(callback);
  off();
  f.emit('/next.stpkg');
  f.bridge.onPackageDirectoryOpen(callback);
  off(); // An obsolete cleanup must not remove the new subscription.
  await Promise.resolve();
  expect(callback).toHaveBeenCalledExactlyOnceWith('/next.stpkg');
  f.emit('/live.stpkg');
  expect(callback).toHaveBeenLastCalledWith('/live.stpkg');
});

it('keeps only the latest pending request in each window context', async () => {
  const a = fixture();
  const b = fixture();
  a.emit('/older.stpkg');
  a.emit('/latest.stpkg');
  b.emit('/separate.stpkg');
  const first = vi.fn();
  const second = vi.fn();
  a.bridge.onPackageDirectoryOpen(first);
  b.bridge.onPackageDirectoryOpen(second);
  await Promise.resolve();
  expect(first).toHaveBeenCalledExactlyOnceWith('/latest.stpkg');
  expect(second).toHaveBeenCalledExactlyOnceWith('/separate.stpkg');
});

it.each([
  { label: 'null', path: null },
  { label: 'number', path: 42 },
  { label: 'object', path: {} },
  { label: 'empty', path: '' },
  { label: 'whitespace', path: ' ' },
  { label: 'null byte', path: 'bad\0path' },
  { label: 'oversized', path: 'x'.repeat(32769) },
])(
  'rejects malformed paths before buffering or delivery ($label)',
  async ({ path }) => {
    const f = fixture();
    f.emit(path);
    const callback = vi.fn();
    f.bridge.onPackageDirectoryOpen(callback);
    await Promise.resolve();
    f.emit(path);
    expect(callback).not.toHaveBeenCalled();
  },
);
