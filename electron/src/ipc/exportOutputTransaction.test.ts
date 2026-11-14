// @vitest-environment node
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { publishExportOutput } from './exportOutputTransaction';
import { retainedFor } from './exportRetainedRecords';
import { IndeterminatePublicationError } from './exportExclusivePublish';

const roots: string[] = [];
const createRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-transaction-test-'),
  );
  roots.push(root);
  return root;
};
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

it.each(['startup failure', 'partial failure', 'cancel'])(
  'does not publish or leave staging output after %s',
  async (failure) => {
    const root = await createRoot();
    const output = path.join(root, 'output.mp4');
    await expect(
      publishExportOutput(output, async (staging) => {
        if (failure !== 'startup failure')
          await fs.writeFile(staging, failure === 'cancel' ? '' : 'partial');
        throw new Error(failure);
      }),
    ).rejects.toThrow(failure);
    expect(await fs.readdir(root)).toEqual([]);
  },
);

it('publishes a completed output and removes only its private staging directory', async () => {
  const root = await createRoot();
  const output = path.join(root, 'output.mp4');
  await fs.writeFile(path.join(root, 'unrelated.mp4'), 'other');
  await publishExportOutput(output, async (staging) =>
    fs.writeFile(staging, 'complete'),
  );
  expect(await fs.readFile(output, 'utf8')).toBe('complete');
  expect(await fs.readFile(path.join(root, 'unrelated.mp4'), 'utf8')).toBe(
    'other',
  );
  expect((await fs.readdir(root)).sort()).toEqual([
    'output.mp4',
    'unrelated.mp4',
  ]);
});

it('does not replace a destination created during rendering', async () => {
  const root = await createRoot();
  const output = path.join(root, 'output.mp4');
  await expect(
    publishExportOutput(output, async (staging) => {
      await fs.writeFile(staging, 'candidate');
      await fs.writeFile(output, 'other job', { flag: 'wx' });
    }),
  ).rejects.toMatchObject({ code: 'EEXIST' });
  expect(await fs.readFile(output, 'utf8')).toBe('other job');
  expect(await fs.readdir(root)).toEqual(['output.mp4']);
});

it('keeps completed individual outputs when a later output fails', async () => {
  const root = await createRoot();
  const first = path.join(root, 'first.mp4');
  const second = path.join(root, 'second.mp4');
  await publishExportOutput(first, async (staging) =>
    fs.writeFile(staging, 'first'),
  );
  await expect(
    publishExportOutput(second, async (staging) => {
      await fs.writeFile(staging, 'partial');
      throw new Error('failed');
    }),
  ).rejects.toThrow('failed');
  expect(await fs.readFile(first, 'utf8')).toBe('first');
  expect(await fs.readdir(root)).toEqual(['first.mp4']);
});

it('does not publish an empty output', async () => {
  const root = await createRoot();
  await expect(
    publishExportOutput(path.join(root, 'output.mp4'), async (staging) =>
      fs.writeFile(staging, ''),
    ),
  ).rejects.toThrow('complete output');
  expect(await fs.readdir(root)).toEqual([]);
});

it('rejects a staging symlink without modifying its target', async () => {
  const root = await createRoot();
  const target = path.join(root, 'protected.mp4');
  await fs.writeFile(target, 'protected');
  await expect(
    publishExportOutput(path.join(root, 'output.mp4'), async (staging) => {
      await fs.symlink(target, staging);
    }),
  ).rejects.toThrow('complete output');
  expect(await fs.readFile(target, 'utf8')).toBe('protected');
  expect(await fs.readdir(root)).toEqual(['protected.mp4']);
});

it('allows only one concurrent transaction to publish the same name', async () => {
  const root = await createRoot();
  const output = path.join(root, 'output.mp4');
  const results = await Promise.allSettled(
    ['first', 'second'].map((content) =>
      publishExportOutput(output, async (staging) =>
        fs.writeFile(staging, content),
      ),
    ),
  );
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1,
  );
  expect(['first', 'second']).toContain(await fs.readFile(output, 'utf8'));
  expect(await fs.readdir(root)).toEqual(['output.mp4']);
});

it('does not publish when shutdown occurs before the commit', async () => {
  const root = await createRoot();
  const controller = new AbortController();
  const output = path.join(root, 'output.mp4');
  await expect(
    publishExportOutput(
      output,
      async (staging) => {
        await fs.writeFile(staging, 'complete');
        controller.abort();
      },
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(await fs.readdir(root)).toEqual([]);
});

it('keeps an already committed output if shutdown follows completion', async () => {
  const root = await createRoot();
  const controller = new AbortController();
  const output = path.join(root, 'output.mp4');
  await publishExportOutput(
    output,
    async (staging) => fs.writeFile(staging, 'complete'),
    controller.signal,
  );
  controller.abort();
  expect(await fs.readFile(output, 'utf8')).toBe('complete');
});

it.each(['success', 'uncertain'])('waits for an in-flight publication after cancellation: %s', async (outcome) => {
  const root = await createRoot(); const output = path.join(root, 'out.mp4'); const controller = new AbortController();
  let release: (() => void) | undefined; let entered: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const finish = vi.fn(); const task = publishExportOutput(output, async (staging) => fs.writeFile(staging, 'complete'), controller.signal, { begin: () => undefined, finish }, async (staging, target) => {
    entered?.(); await blocked;
    if (outcome === 'uncertain') throw new IndeterminatePublicationError();
    await fs.link(staging, target);
  });
  await started; controller.abort(); release?.();
  if (outcome === 'success') {
    await task; expect(await fs.readFile(output, 'utf8')).toBe('complete'); expect(finish).toHaveBeenCalledWith(true);
  } else {
    await expect(task).rejects.toBeInstanceOf(IndeterminatePublicationError); expect(finish).toHaveBeenCalledWith(false);
    expect((await fs.readdir(root)).some((name) => name.startsWith('.sportag-export-'))).toBe(true);
    await expect(fs.stat(output)).rejects.toThrow();
  }
});

it('keeps committed output when the completion callback throws', async () => {
  const root = await createRoot(); const output = path.join(root, 'out.mp4'); const failed = vi.fn();
  await publishExportOutput(output, async (staging) => fs.writeFile(staging, 'complete'), undefined, { begin: () => undefined, finish: () => { throw new Error('callback'); }, callbackFailed: failed });
  expect(failed).toHaveBeenCalledOnce(); expect(await fs.readFile(output, 'utf8')).toBe('complete');
});

it('reports cleanup failure after publication without deleting the committed file', async () => {
  const root = await createRoot();
  const output = path.join(root, 'output.mp4');
  const cleanupFailed = vi.fn();
  await publishExportOutput(
    output,
    async (staging) => {
      await fs.writeFile(staging, 'complete');
      await fs.writeFile(
        path.join(path.dirname(staging), 'unexpected'),
        'keep',
      );
    },
    undefined,
    { begin: () => undefined, finish: () => undefined, cleanupFailed },
  );
  expect(cleanupFailed).toHaveBeenCalledOnce();
  expect(await fs.readFile(output, 'utf8')).toBe('complete');
});

it('preserves the original error when cleanup also fails', async () => {
  const root = await createRoot();
  const failure = new Error('original render failure');
  const cleanupFailed = vi.fn(() => { throw new Error('notification failed'); });
  await expect(publishExportOutput(path.join(root, 'out.mp4'), async (staging) => {
    await fs.writeFile(path.join(path.dirname(staging), 'unowned-entry'), 'keep');
    throw failure;
  }, undefined, { begin: () => undefined, finish: () => undefined, cleanupFailed })).rejects.toBe(failure);
  expect(cleanupFailed).toHaveBeenCalledOnce();
  expect(retainedFor(failure).directories).toEqual([expect.objectContaining({ purpose: 'final-staging', reason: 'cleanup-failed' })]);
});

it('does not remove a staged partial copy when copy reports a retained path', async () => {
  const { ExportCopyIncomplete } = await import('./exportBoundedCopy');
  const root = await createRoot(); let staged = '';
  const onRetained = vi.fn();
  await expect(publishExportOutput(path.join(root, 'final.mp4'), async (candidate) => {
    staged = candidate; await fs.writeFile(candidate, 'partial');
    throw new ExportCopyIncomplete(new Error('disk full'), candidate);
  }, undefined, { begin: () => undefined, finish: () => undefined, cleanupFailed: onRetained })).rejects.toMatchObject({ name: 'ExportCopyIncomplete' });
  expect(await fs.readFile(staged, 'utf8')).toBe('partial');
  expect(onRetained).toHaveBeenCalledOnce();
  await expect(fs.stat(path.join(root, 'final.mp4'))).rejects.toThrow();
});
