// @vitest-environment node
import * as fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, it } from 'vitest';
import { copyWithBudget, ExportCopyIncomplete } from './exportBoundedCopy';
it('copies within a finite budget and never replaces an existing destination', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bounded-copy-'));
 try {
  const source = path.join(root, 'source'); const target = path.join(root, 'target'); await fs.writeFile(source, 'content');
  await copyWithBudget(source, target, { maxBytes: 100, minimumFreeBytes: 0 });
  expect(await fs.readFile(target, 'utf8')).toBe('content');
  await expect(copyWithBudget(source, target, { maxBytes: 100, minimumFreeBytes: 0 })).rejects.toBeInstanceOf(ExportCopyIncomplete);
  expect(await fs.readFile(target, 'utf8')).toBe('content');
 } finally { await fs.rm(root, { recursive: true, force: true }); }
});
it('retains the partial destination and abort cause after cancellation', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bounded-copy-'));
 try {
  const source = path.join(root, 'source'); const target = path.join(root, 'partial'); await fs.writeFile(source, Buffer.alloc(600000));
  const controller = new AbortController(); let result: unknown;
  try { await copyWithBudget(source, target, { maxBytes: 1000000, minimumFreeBytes: 0, signal: controller.signal, onChunk: () => controller.abort() }); } catch (error) { result = error; }
  expect(result).toMatchObject({ name: 'AbortError', retainedPath: target, originalError: { name: 'AbortError' } });
  expect((await fs.stat(target)).size).toBeGreaterThan(0);
 } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('does not report success when its opened source is truncated while copying', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bounded-copy-mutate-'));
 try {
  const source = path.join(root, 'source'); const target = path.join(root, 'partial'); await fs.writeFile(source, Buffer.alloc(600000));
  let changed = false;
  await expect(copyWithBudget(source, target, { maxBytes: 1000000, minimumFreeBytes: 0, onChunk: () => { if (!changed) { changed = true; writeFileSync(source, Buffer.alloc(10)); } } })).rejects.toMatchObject({ name: 'ExportCopyIncomplete', retainedPath: target });
  expect((await fs.stat(target)).size).toBeLessThan(600000);
 } finally { await fs.rm(root, { recursive: true, force: true }); }
});
it('admits a sparse 9 GiB source above the native limit without writing it fully', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bounded-copy-sparse-'));
 try {
  const source = path.join(root, 'source'); const target = path.join(root, 'partial');
  const file = await fs.open(source, 'wx'); await file.truncate(9 * 1024 ** 3); await file.close();
  const controller = new AbortController();
  await expect(copyWithBudget(source, target, { maxBytes: 10 * 1024 ** 3, minimumFreeBytes: 0, signal: controller.signal, onChunk: () => controller.abort() })).rejects.toMatchObject({ name: 'AbortError', retainedPath: target });
  expect((await fs.stat(target)).size).toBeLessThanOrEqual(256 * 1024);
 } finally { await fs.rm(root, { recursive: true, force: true }); }
});
