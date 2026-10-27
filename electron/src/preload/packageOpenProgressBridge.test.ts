import { expect, it, vi } from 'vitest';
import { createPackageOpenProgressBridge } from './packageOpenProgressBridge';

it('validates progress and cancellation replies, exposes only dedicated channels and removes its listener', async () => {
  const transport = {
    invoke: vi.fn<() => Promise<unknown>>(async () => true),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
  const bridge = createPackageOpenProgressBridge(transport);
  const callback = vi.fn();
  const off = bridge.onPackageOpenProgress?.(callback);
  const [channel, listener] = transport.on.mock.calls[0];
  expect(channel).toBe('package:open-progress');
  for (const value of [
    null,
    {},
    { requestId: 'a', phase: 'saving', canCancel: true },
    { requestId: 'a', phase: 'preparing', canCancel: true },
    { requestId: '../path', phase: 'backup-directory', canCancel: true },
  ])
    listener({}, value);
  expect(callback).not.toHaveBeenCalled();
  const valid = { requestId: 'a', phase: 'backup-directory', canCancel: true };
  listener({}, valid);
  expect(callback).toHaveBeenCalledExactlyOnceWith(valid);
  off?.();
  expect(transport.removeListener).toHaveBeenCalledExactlyOnceWith(
    channel,
    listener,
  );
  expect(await bridge.cancelPackageOpen?.('a')).toBe(true);
  expect(transport.invoke).toHaveBeenCalledWith('package:cancel-open', 'a');
  transport.invoke.mockResolvedValue('true');
  await expect(bridge.cancelPackageOpen?.('a')).rejects.toThrow(
    'Invalid package cancellation response',
  );
});
