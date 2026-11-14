// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
const opened = vi.hoisted(() => new Map<number, import('node:fs/promises').FileHandle>());
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, open: async (...args: Parameters<typeof actual.open>) => { const handle = await actual.open(...args); opened.set(handle.fd, handle); return handle; } };
});
vi.mock('electron', () => ({ app: { isPackaged: false } }));
import { publishHeldSource } from './exportHeldPublish';
import { publishExportOutput } from './exportOutputTransaction';
import { retainedFor } from './exportRetainedRecords';
import { createMacClipExporter } from '../nativeExport/macClipExporter';
import { exportResourceContext } from './exportResourceContext';
import { nativeMinimumFreeBytes } from '../nativeExport/nativeCapacityPolicy';

let root = '';
let host = '';
beforeAll(async () => {
  if (process.platform !== 'darwin') return;
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'held-publish-contract-'));
  const source = path.join(root, 'main.cpp');
  host = path.join(root, 'held-host');
  await fs.writeFile(source, '#include "ExclusivePublish.hpp"\nint main(int argc, const char **argv) { return runHeldPublish(argc, argv); }\n');
  execFileSync('/usr/bin/clang++', ['-std=c++17', '-I', path.resolve('native/macos/playback/apple-player'), source, '-o', host], { timeout: 15000, maxBuffer: 65536 });
});
afterAll(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });
const fixture = async (): Promise<{ directory: string; source: string; target: string }> => {
  const directory = await fs.mkdtemp(path.join(root, 'case-'));
  const source = path.join(directory, 'source.mp4');
  await fs.writeFile(source, 'verified video sample');
  return { directory, source, target: path.join(directory, 'final.mp4') };
};
it.skipIf(process.platform !== 'darwin')('publishes the held source even if its pathname is replaced', async () => {
  const item = await fixture();
  const held = await fs.open(item.source, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await fs.rename(item.source, path.join(item.directory, 'original.mp4'));
    await fs.writeFile(item.source, 'unqualified replacement');
    await publishHeldSource(host, held.fd, item.target);
    expect(await fs.readFile(item.target, 'utf8')).toBe('verified video sample');
    expect(await fs.readFile(item.source, 'utf8')).toBe('unqualified replacement');
  } finally { await held.close(); }
});
it.skipIf(process.platform !== 'darwin')('does not replace an existing final output', async () => {
  const item = await fixture();
  await fs.writeFile(item.target, 'existing output');
  const held = await fs.open(item.source, 'r');
  try {
    await expect(publishHeldSource(host, held.fd, item.target)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await fs.readFile(item.target, 'utf8')).toBe('existing output');
  } finally { await held.close(); }
});
it.skipIf(process.platform !== 'darwin')('does not start publication after cancellation', async () => {
  const item = await fixture();
  const held = await fs.open(item.source, 'r');
  const controller = new AbortController(); controller.abort();
  try {
    await expect(publishHeldSource(host, held.fd, item.target, controller.signal)).rejects.toBeDefined();
    await expect(fs.lstat(item.target)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { await held.close(); }
});

it.skipIf(process.platform !== 'darwin')('uses the qualified lease through final publication and preserves a substituted staging pathname', async () => {
  const item = await fixture();
  const cleanupFailed = vi.fn();
  const signal = new AbortController().signal;
  let staging = '';
  const exporter = createMacClipExporter({
    executable: 'mock-exporter', experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 },
    run: async (_binary, manifest) => {
      const input = JSON.parse(await fs.readFile(manifest, 'utf8'));
      await fs.writeFile(input.output, 'qualified result');
      return JSON.stringify({ version: 2, status: 'completed', duration: 1, audioTrack: 0 });
    },
    qualify: async () => true,
    stablePublish: (fd, target) => publishHeldSource(host, fd, target),
  });
  await exportResourceContext.run({ signal, maxFileBytes: 1000, minFreeBytes: nativeMinimumFreeBytes(1000), check: async () => undefined }, () =>
    publishExportOutput(item.target, async (stagingPath) => {
      staging = stagingPath;
      expect(await exporter({ sourcePath: item.source, outputPath: stagingPath, start: 0, duration: 1, audioTrack: 0, signal })).toEqual({ status: 'completed' });
      // A different file appears after the producer returns. Final publication
      // must use the qualified lease, never re-open or delete this pathname.
      await fs.writeFile(stagingPath, 'unrelated staging replacement');
    }, signal, { begin: vi.fn(), finish: vi.fn(), cleanupFailed }),
  );
  expect(await fs.readFile(item.target, 'utf8')).toBe('qualified result');
  expect(await fs.readFile(staging, 'utf8')).toBe('unrelated staging replacement');
  expect(cleanupFailed).toHaveBeenCalledTimes(1);
});
it.skipIf(process.platform !== 'darwin')('retains the qualified source when canceled between rendering and commit', async () => {
  const item = await fixture();
  const controller = new AbortController();
  let candidate = '';
  const exporter = createMacClipExporter({
    executable: 'mock-exporter', experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 },
    run: async (_binary, manifest) => {
      const input = JSON.parse(await fs.readFile(manifest, 'utf8'));
      candidate = input.output;
      await fs.writeFile(candidate, 'qualified result');
      return JSON.stringify({ version: 2, status: 'completed', duration: 1, audioTrack: 0 });
    },
    qualify: async () => true,
    stablePublish: (fd, target) => publishHeldSource(host, fd, target),
  });
  const cleanupFailed = vi.fn();
  const result: unknown = await exportResourceContext.run({ signal: controller.signal, maxFileBytes: 1000, minFreeBytes: nativeMinimumFreeBytes(1000), check: async () => undefined }, () =>
    publishExportOutput(item.target, async (stagingPath) => {
      await exporter({ sourcePath: item.source, outputPath: stagingPath, start: 0, duration: 1, audioTrack: 0, signal: controller.signal });
      controller.abort();
    }, controller.signal, { begin: vi.fn(), finish: vi.fn(), cleanupFailed }),
  ).catch((error: unknown) => error);
  expect(result).toMatchObject({ name: 'AbortError' });
  expect(await fs.readFile(candidate, 'utf8')).toBe('qualified result');
  await expect(fs.lstat(item.target)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(retainedFor(result).directories.some((record) => record.purpose === 'native-temp')).toBe(true);
  expect(cleanupFailed.mock.calls.map(([record]) => record.purpose)).toEqual(['native-temp', 'final-staging']);
});

it.skipIf(process.platform !== 'darwin')('keeps a committed file and reports uncertainty when post-publication inspection fails', async () => {
  const item = await fixture();
  const signal = new AbortController().signal;
  const exporter = createMacClipExporter({
    executable: 'mock-exporter', experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 },
    run: async (_binary, manifest) => {
      const input = JSON.parse(await fs.readFile(manifest, 'utf8'));
      await fs.writeFile(input.output, 'qualified result');
      return JSON.stringify({ version: 2, status: 'completed', duration: 1, audioTrack: 0 });
    },
    qualify: async () => true,
    stablePublish: async (fd, target) => {
      await publishHeldSource(host, fd, target);
      const held = opened.get(fd);
      if (!held) throw new Error('Missing held source');
      vi.spyOn(held, 'stat').mockRejectedValueOnce(Object.assign(new Error('post-clone inspection failed'), { code: 'EIO' }));
    },
  });
  const finish = vi.fn();
  const result: unknown = await exportResourceContext.run({ signal, maxFileBytes: 1000, minFreeBytes: nativeMinimumFreeBytes(1000), check: async () => undefined }, () =>
    publishExportOutput(item.target, async (stagingPath) => {
      await exporter({ sourcePath: item.source, outputPath: stagingPath, start: 0, duration: 1, audioTrack: 0, signal });
    }, signal, { begin: vi.fn(), finish, cleanupFailed: vi.fn() }),
  ).catch((error: unknown) => error);
  expect(result).toMatchObject({ name: 'IndeterminatePublicationError', cause: expect.objectContaining({ code: 'EIO' }) });
  expect(await fs.readFile(item.target, 'utf8')).toBe('qualified result');
  expect(finish).toHaveBeenCalledExactlyOnceWith(false);
});
