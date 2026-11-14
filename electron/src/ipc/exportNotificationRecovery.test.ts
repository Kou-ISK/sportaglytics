// @vitest-environment node
import { expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { publishExportOutput } from './exportOutputTransaction';
import { retainedFor } from './exportRetainedRecords';
import { publishExclusive } from './exportExclusivePublish';

it('preserves the original error and marks retention unknown when cleanup notification fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-notice-primary-'));
  const original = new Error('render failed'); let failure: unknown;
  try {
    try {
      await publishExportOutput(path.join(root, 'final.mp4'), async (stage) => {
        await fs.writeFile(stage, 'partial');
        await fs.writeFile(path.join(path.dirname(stage), 'unexpected'), 'fixture');
        throw original;
      }, undefined, { begin: () => {}, finish: () => {}, cleanupFailed: () => { throw Error('notice failed'); } });
    } catch (error) { failure = error; }
    expect(failure).toBe(original);
    expect(retainedFor(failure).locationUnknown).toBe(true);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('reports a saved output if cleanup notification is unavailable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-notice-missing-'));
  const output = path.join(root, 'final.mp4'); let failure: unknown;
  try {
    try {
      await publishExportOutput(output, async (stage) => { await fs.writeFile(stage, 'complete'); }, undefined,
        { begin: () => {}, finish: () => {} }, async (stage, target) => {
          await publishExclusive(stage, target);
          await fs.writeFile(path.join(path.dirname(stage), 'unexpected'), 'fixture');
        });
    } catch (error) { failure = error; }
    expect(failure).toMatchObject({ name: 'PostCommitRecoveryError', message: expect.stringContaining('保存されました') });
    expect(retainedFor(failure).locationUnknown).toBe(true);
    expect(await fs.readFile(output, 'utf8')).toBe('complete');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('reports a saved output when the commit callback fails without recovery', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-finish-no-recovery-'));
  const output = path.join(root, 'final.mp4'); const original = new Error('finish failed');
  try {
    await expect(publishExportOutput(output, async (stage) => { await fs.writeFile(stage, 'complete'); }, undefined,
      { begin: () => {}, finish: () => { throw original; } }))
      .rejects.toMatchObject({ name: 'PostCommitRecoveryError', originalError: original });
    expect(await fs.readFile(output, 'utf8')).toBe('complete');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
