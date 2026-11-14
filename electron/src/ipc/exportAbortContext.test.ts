import { expect, it } from 'vitest';
import {
  drainExportProcesses,
  exportAbortContext,
  exportProcessContext,
  trackExportProcess,
} from './exportAbortContext';

it('keeps signals isolated across concurrent asynchronous exports', async () => {
  const first = new AbortController();
  const second = new AbortController();
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const a = exportAbortContext.run(first.signal, async () => {
    await wait;
    return exportAbortContext.getStore();
  });
  const b = exportAbortContext.run(second.signal, async () => {
    first.abort();
    release?.();
    await Promise.resolve();
    return exportAbortContext.getStore();
  });
  expect(await a).toBe(first.signal);
  expect(await b).toBe(second.signal);
  expect(second.signal.aborted).toBe(false);
  expect(exportAbortContext.getStore()).toBeUndefined();
});

it('drains sibling processes after a fail-fast aggregate rejects', async () => {
  const active = new Set<Promise<unknown>>();
  let finish: (() => void) | undefined;
  let drained = false;
  await exportProcessContext.run(active, async () => {
    const slow = trackExportProcess(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const failed = trackExportProcess(
      Promise.reject(new Error('probe failed')),
    );
    await expect(Promise.all([slow, failed])).rejects.toThrow('probe failed');
    const drain = drainExportProcesses(active).then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    finish?.();
    await drain;
    expect(drained).toBe(true);
    expect(active.size).toBe(0);
  });
});
