import { afterEach, expect, it, vi } from 'vitest';
import { PlaybackRangeBuffer } from './PlaybackRangeBuffer';
import type {
  PlaybackRangeBufferPort,
  PlaybackRangeReader,
} from './PlaybackRangeBuffer';
import type { PlaybackRangeIndex } from './rangeBufferIndex';
const index: PlaybackRangeIndex = {
  sourceGeneration: 'session-a',
  initializationBytes: 10,
  presentationEnd: 20.067,
  fragments: Array.from({ length: 10 }, (_, id) => ({
    id,
    bytes: 100,
    videoStart: 0.055 + id * 2,
    videoEnd: 0.055 + (id + 1) * 2,
    sampleStart: 0.043 + id * 2,
    sampleEnd: 0.067 + (id + 1) * 2,
    dependencies: id ? [id - 1, id] : [id],
  })),
};
const ranges = (rows: number[][]): TimeRanges => ({
  length: rows.length,
  start: (i) => rows[i][0],
  end: (i) => rows[i][1],
});
class BufferPort implements PlaybackRangeBufferPort {
  updating = false;
  auto = true;
  rows: number[][] = [];
  events = new Map<string, Set<() => void>>();
  get buffered(): TimeRanges {
    return ranges(this.rows);
  }
  addEventListener(event: string, cb: () => void): void {
    const set = this.events.get(event) ?? new Set();
    set.add(cb);
    this.events.set(event, set);
  }
  removeEventListener(event: string, cb: () => void): void {
    this.events.get(event)?.delete(cb);
  }
  emit(event: string): void {
    for (const cb of [...(this.events.get(event) ?? [])]) cb();
  }
  finish(): void {
    this.updating = false;
    this.emit('updateend');
  }
  abort = vi.fn(() => {
    this.updating = false;
    this.emit('abort');
    queueMicrotask(() => this.finish());
  });
  appendBuffer = vi.fn((bytes: ArrayBuffer) => {
    expect(this.updating).toBe(false);
    this.updating = true;
    const id = new Uint8Array(bytes)[0] - 1;
    if (id >= 0) {
      const row = index.fragments[id];
      this.rows.push([row.videoStart, row.videoEnd]);
    }
    if (this.auto) queueMicrotask(() => this.finish());
  });
  remove = vi.fn((start: number, end: number) => {
    expect(this.updating).toBe(false);
    this.updating = true;
    this.rows = this.rows.flatMap(([a, b]) =>
      a >= end || b <= start
        ? [[a, b]]
        : [...(a < start ? [[a, start]] : []), ...(b > end ? [[end, b]] : [])],
    );
    if (this.auto) queueMicrotask(() => this.finish());
  });
}
const bytes = (id: 'initialization' | number): ArrayBuffer => {
  const data = new Uint8Array(id === 'initialization' ? 10 : 100);
  data[0] = id === 'initialization' ? 0 : id + 1;
  return data.buffer;
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 90; i++) await Promise.resolve();
};
const setup = (
  limit = 410,
): {
  port: BufferPort;
  reader: PlaybackRangeReader;
  fail: ReturnType<typeof vi.fn>;
  owner: PlaybackRangeBuffer;
  current: { time: number };
} => {
  const port = new BufferPort(),
    fail = vi.fn(),
    current = { time: 0.055 };
  const reader: PlaybackRangeReader = {
    read: vi.fn(async (id) => bytes(id)),
    close: vi.fn(async () => {}),
  };
  return {
    port,
    reader,
    fail,
    current,
    owner: new PlaybackRangeBuffer(
      index,
      port,
      reader,
      fail,
      () => current.time,
      limit,
      100,
    ),
  };
};
const detach = (owner: PlaybackRangeBuffer): Promise<void> => {
  const closed = owner.dispose();
  owner.sourceClosed();
  return closed;
};
const video = (time: number) => ({
  currentTime: time,
  readyState: 4,
  seeking: false,
  error: null,
});
afterEach(() => vi.useRealTimers());
it('loads original-clock dependencies without changing fps/offset and waits for the requested seek', async () => {
  const { owner, reader, fail } = setup();
  owner.seek(0.555);
  await flush();
  expect(fail).not.toHaveBeenCalled();
  expect(owner.isReady(0.555, video(0.055))).toBe(false);
  expect(owner.isReady(0.555, video(0.555))).toBe(true);
  expect(owner.retainedBytes).toBeLessThanOrEqual(410);
  await detach(owner);
  expect(reader.close).toHaveBeenCalledOnce();
});
it('coalesces rapid demands while the old read still owns its bytes', async () => {
  const { owner, reader, current, port } = setup();
  let release: ((x: ArrayBuffer) => void) | undefined;
  reader.read = vi.fn<PlaybackRangeReader['read']>((id) =>
    id === 0
      ? new Promise((resolve) => {
          release = resolve;
        })
      : Promise.resolve(bytes(id)),
  );
  owner.demand(0.555);
  await flush();
  current.time = 16.5;
  owner.seek(8.5);
  owner.seek(16.5);
  expect(port.abort).not.toHaveBeenCalled();
  release?.(bytes(0));
  await flush();
  expect(
    port.appendBuffer.mock.calls.some(
      ([data]) => new Uint8Array(data)[0] === 1,
    ),
  ).toBe(false);
  expect(owner.isReady(16.5, video(16.5))).toBe(true);
  await detach(owner);
});
it('new demands during append wait for its own updateend before eviction/replacement', async () => {
  const { owner, port, current } = setup();
  owner.demand(0.555);
  await flush();
  port.auto = false;
  current.time = 16.5;
  owner.seek(16.5);
  await flush();
  expect(port.updating).toBe(true);
  const calls = port.appendBuffer.mock.calls.length;
  owner.seek(12.5);
  await flush();
  expect(port.appendBuffer).toHaveBeenCalledTimes(calls);
  expect(port.abort).not.toHaveBeenCalled();
  port.auto = true;
  port.finish();
  await flush();
  expect(owner.isReady(12.5, video(12.5))).toBe(true);
  await detach(owner);
});
it('evicts old nonprotected intervals and rereads them after a later seek', async () => {
  const { owner, port, reader, current, fail } = setup();
  owner.demand(0.555);
  await flush();
  current.time = 16.5;
  owner.seek(16.5);
  await flush();
  expect(port.remove).toHaveBeenCalled();
  expect(fail).not.toHaveBeenCalled();
  current.time = 0.555;
  owner.seek(0.555);
  await flush();
  expect(owner.isReady(0.555, video(0.555))).toBe(true);
  expect(
    vi.mocked(reader.read).mock.calls.filter(([id]) => id === 0).length,
  ).toBe(2);
  expect(owner.retainedBytes).toBeLessThanOrEqual(410);
  await detach(owner);
});
it('does not evict the native position still in use to satisfy a distant target', async () => {
  const { owner, port, fail } = setup(210);
  owner.demand(0.555);
  await flush();
  owner.seek(16.5);
  await flush();
  expect(fail).toHaveBeenCalledOnce();
  expect(owner.failure?.message).toContain('PINNED');
  expect(port.remove.mock.calls.some(([a, b]) => a <= 0.055 && 0.055 < b)).toBe(
    false,
  );
  await detach(owner);
});
it('Session cancellation owns a pending read and closes once only after acknowledgement', async () => {
  const { owner, reader, port } = setup();
  let release: ((x: ArrayBuffer) => void) | undefined;
  reader.read = vi.fn<PlaybackRangeReader['read']>(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  owner.demand(0.555);
  await flush();
  const closing = owner.dispose();
  expect(reader.close).not.toHaveBeenCalled();
  expect(owner.retainedBytes).toBe(10);
  release?.(bytes('initialization'));
  owner.sourceClosed();
  await closing;
  expect(port.appendBuffer).not.toHaveBeenCalled();
  expect(reader.close).toHaveBeenCalledOnce();
  expect(owner.dispose()).toBe(closing);
});
it('read timeout reports fallback but retains ownership and capacity until late completion', async () => {
  vi.useFakeTimers();
  const { owner, reader, fail, port } = setup();
  let release: ((x: ArrayBuffer) => void) | undefined;
  reader.read = vi.fn<PlaybackRangeReader['read']>(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  owner.demand(0.555);
  await flush();
  await vi.advanceTimersByTimeAsync(101);
  expect(fail).toHaveBeenCalledOnce();
  expect(owner.retainedBytes).toBe(10);
  owner.demand(8.5);
  expect(reader.read).toHaveBeenCalledOnce();
  const close = owner.dispose();
  expect(reader.close).not.toHaveBeenCalled();
  release?.(bytes('initialization'));
  owner.sourceClosed();
  await close;
  expect(port.appendBuffer).not.toHaveBeenCalled();
});
it('native timeout holds byte reservation until sourceclose confirms detachment', async () => {
  vi.useFakeTimers();
  const { owner, port, fail, reader } = setup();
  port.auto = false;
  port.abort = vi.fn(() => {
    port.updating = false;
    port.emit('abort');
  });
  owner.demand(0.555);
  await flush();
  await vi.advanceTimersByTimeAsync(101);
  expect(fail).toHaveBeenCalledOnce();
  expect(owner.retainedBytes).toBe(10);
  const closing = owner.dispose();
  await flush();
  expect(reader.close).not.toHaveBeenCalled();
  owner.sourceClosed();
  await closing;
  expect(reader.close).toHaveBeenCalledOnce();
});
it('size mismatch, quota and sourceclose fail once without retries', async () => {
  for (const kind of ['size', 'quota', 'closed']) {
    const { owner, reader, port, fail } = setup();
    if (kind === 'size')
      reader.read = vi.fn<PlaybackRangeReader['read']>(
        async () => new ArrayBuffer(1),
      );
    if (kind === 'quota')
      port.appendBuffer = vi.fn(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
    owner.demand(0.555);
    await flush();
    if (kind === 'closed') owner.sourceClosed();
    owner.demand(4.5);
    await flush();
    expect(fail).toHaveBeenCalledOnce();
    expect(owner.isReady(0.555, video(0.555))).toBe(false);
    await detach(owner);
  }
});
it('failed close remains rejected and cannot be automatically retried', async () => {
  const { owner, reader } = setup();
  reader.close = vi.fn(async () => {
    throw Error('close uncertain');
  });
  owner.sourceClosed();
  await expect(owner.dispose()).rejects.toThrow('uncertain');
  await expect(owner.dispose()).rejects.toThrow('uncertain');
  expect(reader.close).toHaveBeenCalledOnce();
});

it('native eviction cannot leave stale ready records or an endless common-clock hold', async () => {
  const { owner, port, fail } = setup();
  owner.demand(0.555);
  await flush();
  port.rows = [];
  owner.demand(0.555);
  await flush();
  expect(owner.failure?.message).toBe('RANGE_NATIVE_COVERAGE_LOST');
  expect(fail).toHaveBeenCalledOnce();
  await detach(owner);
});
it('explicit empty prefix seek accepts the first proved sample without shifting the shared clock', async () => {
  const { owner } = setup();
  owner.seek(0);
  await flush();
  expect(owner.isReady(0, video(0.055))).toBe(true);
  await detach(owner);
});

it('idle native buffers remain owned and charged until actual sourceclose', async () => {
  const { owner, reader } = setup();
  owner.demand(0.555);
  await flush();
  const charged = owner.retainedBytes;
  const closing = owner.dispose();
  await flush();
  expect(reader.close).not.toHaveBeenCalled();
  expect(owner.retainedBytes).toBe(charged);
  owner.sourceClosed();
  await closing;
  expect(owner.retainedBytes).toBe(0);
});

it('failed append remains charged after a late updateend until actual detach', async () => {
  vi.useFakeTimers();
  const { owner, port } = setup();
  port.auto = false;
  owner.demand(0.555);
  await flush();
  await vi.advanceTimersByTimeAsync(101);
  port.finish();
  await flush();
  expect(owner.retainedBytes).toBe(10);
  await detach(owner);
  expect(owner.retainedBytes).toBe(0);
});

it('throwing read failure observer leaves the failed state and owned read intact', async () => {
  vi.useFakeTimers();
  const port = new BufferPort();
  let release: ((data: ArrayBuffer) => void) | undefined;
  const reader: PlaybackRangeReader = {
    read: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    close: vi.fn(async () => {}),
  };
  const owner = new PlaybackRangeBuffer(
    index,
    port,
    reader,
    () => {
      throw Error('observer');
    },
    () => 0.055,
    410,
    100,
  );
  owner.demand(0.555);
  await flush();
  await vi.advanceTimersByTimeAsync(101);
  expect(owner.failure?.message).toContain('UNCONFIRMED');
  expect(owner.retainedBytes).toBe(10);
  const closing = owner.dispose();
  owner.sourceClosed();
  release?.(bytes('initialization'));
  await closing;
});

it('partial neighboring native data stays charged after an overlapping eviction', async () => {
  const { owner, port, reader, current } = setup();
  owner.demand(0.555);
  await flush();
  current.time = 8.5;
  owner.seek(8.5);
  await flush();
  expect(port.remove).toHaveBeenCalledWith(0.043, 2.067);
  expect(port.rows.some(([a, b]) => a === 2.067 && b === 4.055)).toBe(true);
  expect(owner.retainedBytes).toBe(410);
  expect(vi.mocked(reader.read).mock.calls.some(([id]) => id === 5)).toBe(
    false,
  );
  await detach(owner);
});
