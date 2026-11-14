import { expect, it, vi } from 'vitest';
import { HeldSeekQueue } from './heldSeekQueue';
const flush = async (): Promise<void> => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};
it('keeps one display transaction through response and paint, then drains the latest goal', async () => {
  const shown: number[] = [];
  const completions: (() => void)[] = [];
  const present = vi.fn(
    (time: number) =>
      new Promise<void>((resolve) => {
        completions.push(() => {
          shown.push(time);
          resolve();
        });
      }),
  );
  const queue = new HeldSeekQueue(present, vi.fn());
  queue.request(20);
  for (let n = 19; n >= 10; n--) queue.request(n);
  await flush();
  expect(present).toHaveBeenCalledTimes(1);
  completions.shift()!();
  await flush();
  expect(shown).toEqual([20]);
  expect(present.mock.calls.map(([time]) => time)).toEqual([20, 10]);
  // Release is simply absence of more input. Final pending demand still completes.
  completions.shift()!();
  await flush();
  expect(shown).toEqual([20, 10]);
});
it('cancels old pending work and ignores its completion after replacement', async () => {
  let done = (): void => {};
  const present = vi.fn(
    (_time: number, signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        done = resolve;
        expect(signal.aborted).toBe(false);
      }),
  );
  const old = new HeldSeekQueue(present, vi.fn());
  old.request(10);
  old.request(9);
  old.cancel();
  const newer = new HeldSeekQueue(async (time) => {
    expect(time).toBe(25);
  }, vi.fn());
  newer.request(25);
  done();
  await flush();
  expect(present).toHaveBeenCalledTimes(1);
  expect(present.mock.calls[0][1].aborted).toBe(true);
});
it('discards unissued demand on release without aborting the in-flight seek', async () => {
  let finish = (): void => {};
  let signal!: AbortSignal;
  const present = vi.fn((_time: number, current: AbortSignal) => {
    signal = current;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const queue = new HeldSeekQueue(present, vi.fn());
  queue.request(10);
  queue.request(9);
  queue.discardPending();
  expect(signal.aborted).toBe(false);
  expect(queue.settled).toBe(false);
  finish();
  await flush();
  expect(present).toHaveBeenCalledTimes(1);
  expect(queue.settled).toBe(true);
});
it('signals idle only after the in-flight image settles and resolves cancellation separately', async () => {
  let finish = (): void => {};
  const queue = new HeldSeekQueue(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    vi.fn(),
  );
  queue.request(10);
  queue.request(9);
  queue.discardPending();
  const idle = vi.fn();
  void queue.whenIdle().then(idle);
  await flush();
  expect(idle).not.toHaveBeenCalled();
  finish();
  await flush();
  expect(idle).toHaveBeenCalledWith(true);
  let pendingFinish = (): void => {};
  const cancelled = new HeldSeekQueue(
    () =>
      new Promise<void>((resolve) => {
        pendingFinish = resolve;
      }),
    vi.fn(),
  );
  cancelled.request(5);
  const result = cancelled.whenIdle();
  cancelled.cancel();
  expect(await result).toBe(false);
  pendingFinish();
  await flush();
});
