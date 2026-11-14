// @vitest-environment node
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ committed: false }));
vi.mock('./exportExclusivePublish', () => {
  class IndeterminatePublicationError extends Error {
    retainedDirectories: unknown[] = [];
    retain(record: unknown): void {
      this.retainedDirectories.push(record);
    }
  }
  return {
    IndeterminatePublicationError,
    describeExportStaging: async (directory: string, purpose: string) => ({
      id: 'test',
      path: directory,
      purpose,
      device: '1',
      inode: '1',
      reason: 'publication-uncertain',
      writerStatus: 'unknown',
    }),
    publishExclusive: async (source: string, target: string) => {
      if (state.committed) await fs.rename(source, target);
      throw new IndeterminatePublicationError('uncertain');
    },
  };
});
import { publishExportOutput } from './exportOutputTransaction';

it('does not remove an output when publication succeeded but its receipt was lost', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-uncertain-published-'),
  );
  state.committed = true;
  try {
    const target = path.join(root, 'final.mp4');
    await expect(
      publishExportOutput(target, async (staged) =>
        fs.writeFile(staged, 'published'),
      ),
    ).rejects.toThrow('uncertain');
    expect(await fs.readFile(target, 'utf8')).toBe('published');
    expect(
      (await fs.readdir(root)).some((name) =>
        name.startsWith('.sportag-export-'),
      ),
    ).toBe(true);
  } finally {
    state.committed = false;
    await fs.rm(root, { recursive: true, force: true });
  }
});
it('preserves the staging evidence and does not publish or retry an uncertain result', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-uncertain-'));
  try {
    const target = path.join(root, 'final.mp4');
    const failed = vi.fn();
    await expect(
      publishExportOutput(
        target,
        async (staged) => fs.writeFile(staged, 'candidate'),
        undefined,
        {
          begin: () => undefined,
          finish: () => undefined,
          cleanupFailed: failed,
        },
      ),
    ).rejects.toThrow('uncertain');
    const files = await fs.readdir(root);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\.sportag-export-/);
    expect(
      await fs.readFile(path.join(root, files[0], 'output.mp4'), 'utf8'),
    ).toBe('candidate');
    expect(failed).toHaveBeenCalledOnce();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
