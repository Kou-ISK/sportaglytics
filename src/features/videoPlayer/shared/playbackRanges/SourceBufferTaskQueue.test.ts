import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceBufferTaskQueue } from './SourceBufferTaskQueue';
import type { RangeSourceBufferPort } from './SourceBufferTaskQueue';

class BufferPort implements RangeSourceBufferPort {
  updating = false;
  listeners = new Map<string, Set<() => void>>();
  abort = vi.fn(() => {
    this.updating = false;
    this.emit('abort');
  });
  addEventListener(event: string, listener: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }
  removeEventListener(event: string, listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event: string): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener();
  }
  finish(): void {
    this.updating = false;
    this.emit('updateend');
  }
}

describe('SourceBufferTaskQueue ownership', () => {
  afterEach(() => vi.useRealTimers());
  const setup = (): {
    port: BufferPort;
    fail: ReturnType<typeof vi.fn>;
    queue: SourceBufferTaskQueue;
    signal: AbortController;
  } => {
    const port = new BufferPort();
    const fail = vi.fn();
    return {
      port,
      fail,
      queue: new SourceBufferTaskQueue(port, fail, 100),
      signal: new AbortController(),
    };
  };

  it('holds append through updateend and prevents concurrent removal', async () => {
    const { port, queue, signal } = setup();
    const first = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    const remove = vi.fn();
    await expect(queue.run(remove, signal.signal)).rejects.toThrow(
      'UNAVAILABLE',
    );
    expect(remove).not.toHaveBeenCalled();
    expect(queue.pending).toBe(true);
    port.finish();
    await first;
    expect(queue.pending).toBe(false);
    const next = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    port.finish();
    await next;
  });

  it('cancellation does not release ownership before abort updateend', async () => {
    const { port, queue, signal, fail } = setup();
    const pending = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    const rejected = expect(pending).rejects.toThrow('CANCELLED');
    signal.abort();
    queue.cancel();
    expect(port.abort).toHaveBeenCalledTimes(1);
    expect(queue.pending).toBe(true);
    let drained = false;
    void queue.drained().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    port.finish();
    await rejected;
    await queue.drained();
    expect(fail).toHaveBeenCalledTimes(1);
    await expect(
      queue.run(vi.fn(), new AbortController().signal),
    ).rejects.toThrow('UNAVAILABLE');
  });

  it('error before updateend cannot become successful completion', async () => {
    const { port, queue, signal } = setup();
    const pending = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    const rejected = expect(pending).rejects.toThrow('MEDIA_ERROR');
    port.emit('error');
    expect(queue.pending).toBe(true);
    port.finish();
    await rejected;
  });

  it('deadline rejects caller but retains native ownership and later drain', async () => {
    vi.useFakeTimers();
    const { port, queue, signal } = setup();
    const pending = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    const rejected = expect(pending).rejects.toThrow('UNCONFIRMED');
    await vi.advanceTimersByTimeAsync(101);
    await rejected;
    expect(queue.pending).toBe(true);
    await expect(queue.run(vi.fn(), signal.signal)).rejects.toThrow(
      'UNAVAILABLE',
    );
    port.finish();
    await queue.drained();
    expect(queue.pending).toBe(false);
    expect(queue.failure).not.toBeNull();
  });

  it('sourceclose confirms detached work but permanently rejects reuse', async () => {
    const { port, queue, signal } = setup();
    const pending = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    const rejected = expect(pending).rejects.toThrow('SOURCE_CLOSED');
    queue.sourceClosed();
    await rejected;
    await queue.drained();
    port.emit('updateend');
    await expect(queue.run(vi.fn(), signal.signal)).rejects.toThrow(
      'UNAVAILABLE',
    );
  });

  it('pre-aborted requests never invoke native work', async () => {
    const { queue, signal } = setup();
    signal.abort();
    const action = vi.fn();
    await expect(queue.run(action, signal.signal)).rejects.toThrow('CANCELLED');
    expect(action).not.toHaveBeenCalled();
    expect(queue.pending).toBe(false);
  });

  it('quota throw cannot start an unbounded retry or free other work', async () => {
    const { queue, signal, fail } = setup();
    await expect(
      queue.run(() => {
        throw new DOMException('full', 'QuotaExceededError');
      }, signal.signal),
    ).rejects.toThrow('full');
    expect(queue.pending).toBe(false);
    expect(fail).toHaveBeenCalledTimes(1);
    await expect(queue.run(vi.fn(), signal.signal)).rejects.toThrow(
      'UNAVAILABLE',
    );
  });
});

it('throwing failure observer cannot suppress timeout settlement or release ownership', async () => {
  vi.useFakeTimers();
  const port = new BufferPort(),
    signal = new AbortController();
  const queue = new SourceBufferTaskQueue(
    port,
    () => {
      throw Error('observer');
    },
    100,
  );
  const pending = queue.run(() => {
      port.updating = true;
    }, signal.signal),
    rejected = expect(pending).rejects.toThrow('UNCONFIRMED');
  await vi.advanceTimersByTimeAsync(101);
  await rejected;
  expect(queue.pending).toBe(true);
  queue.sourceClosed();
  await queue.drained();
  vi.useRealTimers();
});
it('throwing error/cancel observer still permits the owned terminal acknowledgement', async () => {
  for (const event of ['error', 'cancel']) {
    const port = new BufferPort(),
      signal = new AbortController(),
      queue = new SourceBufferTaskQueue(
        port,
        () => {
          throw Error('observer');
        },
        100,
      );
    const pending = queue.run(() => {
      port.updating = true;
    }, signal.signal);
    const rejected = expect(pending).rejects.toThrow();
    if (event === 'error') port.emit('error');
    else signal.abort();
    expect(queue.pending).toBe(true);
    port.finish();
    await rejected;
    await queue.drained();
  }
});
