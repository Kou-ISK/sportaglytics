import { expect, it, vi } from 'vitest';
import type { NativePlaybackController } from './nativePlaybackController';
import { waitForNativePresentation } from './waitForNativePresentation';

it('runs stop confirmation before a subsequent operation and Promise continuations', async () => {
  let listener = (): void => {};
  let phase = 'closing';
  const native = {
    commandRevision: 3,
    isFallingBack: true,
    hasConfirmedSeek: false,
    snapshot: () => ({ phase }),
    subscribe: (callback: () => void) => {
      listener = callback;
      return () => {};
    },
  } as unknown as NativePlaybackController;
  const order: string[] = [];
  const done = waitForNativePresentation(
    native,
    3,
    new AbortController().signal,
    () => order.push('confirmed'),
  ).then(() => order.push('promise'));
  phase = 'original';
  listener();
  order.push('new-operation');
  await done;
  expect(order).toEqual(['confirmed', 'new-operation', 'promise']);
});
it('does not invoke confirmation after cancellation', async () => {
  let listener = (): void => {};
  const native = {
    commandRevision: 3,
    isFallingBack: true,
    snapshot: () => ({ phase: 'closing' }),
    subscribe: (callback: () => void) => {
      listener = callback;
      return () => {};
    },
  } as unknown as NativePlaybackController;
  const abort = new AbortController();
  const confirmed = vi.fn();
  const done = waitForNativePresentation(native, 3, abort.signal, confirmed);
  abort.abort();
  listener();
  await expect(done).rejects.toThrow('REVERSE_CANCELLED');
  expect(confirmed).not.toHaveBeenCalled();
});
