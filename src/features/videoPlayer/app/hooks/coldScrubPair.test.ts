import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColdScrubPair } from './coldScrubPair';

describe('late angle while scrubbing', () => {
  afterEach(() => vi.useRealTimers());
  it('allows one request in a 64 ms window and never publishes the superseded pair', async () => {
    vi.useFakeTimers();
    const pair = new ColdScrubPair(3);
    let cancelled = false;
    const first = pair.present(
      3,
      new AbortController().signal,
      (_, signal) =>
        new Promise<number>((resolve) =>
          signal.addEventListener('abort', () => {
            cancelled = true;
            resolve(3);
          }),
        ),
    );
    pair.request(4);
    await vi.advanceTimersByTimeAsync(32);
    pair.request(5);
    await vi.advanceTimersByTimeAsync(31);
    expect(cancelled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await first).toBeUndefined();
    expect(
      await pair.present(5, new AbortController().signal, async () => 4.99),
    ).toBe(4.99);
  });
  it('does not cancel a path that returns to its pending position', async () => {
    vi.useFakeTimers();
    const pair = new ColdScrubPair(3);
    let resolve!: (t: number) => void;
    const first = pair.present(
      3,
      new AbortController().signal,
      () =>
        new Promise<number>((r) => {
          resolve = r;
        }),
    );
    pair.request(4);
    pair.request(3);
    await vi.advanceTimersByTimeAsync(100);
    resolve(3);
    expect(await first).toBe(3);
  });
  it('does not publish after owner cancellation even if a decoder ignores abort', async () => {
    const owner = new AbortController();
    const pair = new ColdScrubPair(3);
    let resolve!: (t: number) => void;
    const proof = pair.present(
      3,
      owner.signal,
      () =>
        new Promise<number>((r) => {
          resolve = r;
        }),
    );
    owner.abort();
    resolve(3);
    expect(await proof).toBeUndefined();
  });
});
