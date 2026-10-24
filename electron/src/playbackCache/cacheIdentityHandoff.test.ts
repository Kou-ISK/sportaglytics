import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CacheIdentityHandoff } from './cacheIdentityHandoff';
import { CacheMediaReadAudit } from './cacheMediaReadAudit';

let root: string;
let file: string;
let handoff: CacheIdentityHandoff;
const operationSignal = new AbortController().signal;
const signal = (): AbortSignal => operationSignal;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-handoff-'));
  file = path.join(root, 'media');
  await fs.writeFile(file, 'complete candidate');
  handoff = new CacheIdentityHandoff(signal());
});
afterEach(async () => {
  await handoff.close(true);
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

it('transfers one fresh digest once and returns independent snapshots', async () => {
  const reads = vi.fn();
  handoff = new CacheIdentityHandoff(signal(), reads);
  const captured = await handoff.capture(file, signal());
  const expected = structuredClone(captured);
  captured.identity.sha256 = 'tampered';
  expect(await handoff.consume(file, signal())).toEqual(expected);
  expect(reads).toHaveBeenCalledTimes(1);
  expect(reads.mock.calls[0][1]).toMatchObject({ bytes: 18, verified: true });
  await expect(handoff.consume(file, signal())).rejects.toThrow('UNAVAILABLE');
  await expect(handoff.capture(file, signal())).rejects.toThrow('USED');
});
it.each(['write', 'replace', 'symlink', 'hardlink'])(
  'rejects %s between capture and consume even with matching size or restored mtime',
  async (change) => {
    const stat = await fs.stat(file);
    await handoff.capture(file, signal());
    if (change === 'write') {
      await fs.writeFile(file, 'changed! candidate');
      await fs.utimes(file, stat.atime, stat.mtime);
    } else if (change === 'hardlink')
      await fs.link(file, path.join(root, 'link'));
    else {
      const replacement = path.join(root, 'replacement');
      await fs.writeFile(replacement, 'complete candidate');
      if (change === 'replace') await fs.rename(replacement, file);
      else {
        await fs.unlink(file);
        await fs.symlink(replacement, file);
      }
    }
    await expect(handoff.consume(file, signal())).rejects.toThrow(
      'CACHE_SOURCE_CHANGED',
    );
  },
);
it('rejects another path and a closed capability', async () => {
  await handoff.capture(file, signal());
  await expect(handoff.consume(file + '.other', signal())).rejects.toThrow(
    'UNAVAILABLE',
  );
  await handoff.close();
  await expect(handoff.consume(file, signal())).rejects.toThrow('UNAVAILABLE');
});
it.each(['outer', 'worker'])(
  'honors %s cancellation after capture',
  async (which) => {
    const outer = new AbortController(),
      worker = new AbortController();
    handoff = new CacheIdentityHandoff(outer.signal);
    await handoff.capture(file, worker.signal);
    (which === 'outer' ? outer : worker).abort();
    await expect(handoff.consume(file, worker.signal)).rejects.toThrow();
    await handoff.close();
  },
);
it.each(['cancel', 'close'])(
  'drains a pending open on %s before closing the installed handle',
  async (action) => {
    const cancel = new AbortController();
    handoff = new CacheIdentityHandoff(cancel.signal);
    const open = fs.open.bind(fs);
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const handle = await open(file, 'r');
    const close = vi.spyOn(handle, 'close');
    vi.spyOn(fs, 'open').mockImplementationOnce(async () => {
      entered?.();
      await pending;
      return handle;
    });
    const capturing = handoff.capture(file, signal());
    const rejected = expect(capturing).rejects.toThrow();
    await started;
    if (action === 'cancel') cancel.abort();
    const closing = handoff.close();
    expect(close).not.toHaveBeenCalled();
    release?.();
    await rejected;
    await closing;
    expect(close).toHaveBeenCalledTimes(1);
  },
);
it('latches a failed close until explicit cleanup retry and never returns that proof', async () => {
  const open = fs.open.bind(fs);
  const handle = await open(file, 'r');
  const originalClose = handle.close.bind(handle);
  const close = vi
    .spyOn(handle, 'close')
    .mockRejectedValueOnce(Error('close unconfirmed'))
    .mockImplementation(originalClose);
  vi.spyOn(fs, 'open').mockResolvedValueOnce(handle);
  await handoff.capture(file, signal());
  await expect(handoff.consume(file, signal())).rejects.toThrow(
    'close unconfirmed',
  );
  await expect(handoff.close()).rejects.toThrow('close unconfirmed');
  expect(close).toHaveBeenCalledTimes(1);
  await handoff.close(true);
  expect(close).toHaveBeenCalledTimes(2);
  await expect(handoff.consume(file, signal())).rejects.toThrow('UNAVAILABLE');
});
it('rejects initial hardlinks and ignores advisory observer failure', async () => {
  await fs.link(file, path.join(root, 'link'));
  await expect(handoff.capture(file, signal())).rejects.toThrow(
    'INVALID_SOURCE',
  );
  await handoff.close();
  await fs.unlink(path.join(root, 'link'));
  handoff = new CacheIdentityHandoff(signal(), () => {
    throw Error('observer');
  });
  await handoff.capture(file, signal());
  expect((await handoff.consume(file, signal())).identity.bytes).toBe(18);
});
it('bounds audit records, marks overflow and keeps snapshots independent', () => {
  const audit = new CacheMediaReadAudit(file);
  for (let i = 0; i < 33; i++)
    audit.observe(file, { bytes: i, verified: true, elapsedMs: 1 });
  const snapshot = audit.snapshot();
  expect(snapshot.records).toHaveLength(32);
  expect(snapshot.overflow).toBe(true);
  snapshot.records[0].bytes = 123;
  expect(audit.snapshot().records[0].bytes).toBe(0);
});

it('rejects consuming another worker operation capability', async () => {
  await handoff.capture(file, signal());
  await expect(
    handoff.consume(file, new AbortController().signal),
  ).rejects.toThrow('UNAVAILABLE');
  expect((await handoff.consume(file, signal())).identity.bytes).toBe(18);
});
it('records the returned chunk even when cancellation arrives during its read', async () => {
  const cancel = new AbortController();
  const observed = vi.fn();
  handoff = new CacheIdentityHandoff(cancel.signal, observed);
  const open = fs.open.bind(fs);
  const handle = await open(file, 'r');
  const read = handle.read.bind(handle);
  vi.spyOn(handle, 'read').mockImplementationOnce(async (...args) => {
    const result = await read(...args);
    cancel.abort();
    return result;
  });
  vi.spyOn(fs, 'open').mockResolvedValueOnce(handle);
  await expect(handoff.capture(file, signal())).rejects.toThrow();
  await handoff.close();
  expect(observed).toHaveBeenCalledExactlyOnceWith(
    file,
    expect.objectContaining({ bytes: 18, verified: false }),
  );
});
