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
