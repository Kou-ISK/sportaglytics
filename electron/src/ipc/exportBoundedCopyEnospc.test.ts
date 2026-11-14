// @vitest-environment node
import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ open: vi.fn(), statfs: vi.fn() }));
vi.mock('node:fs/promises', () => ({ open: m.open, statfs: m.statfs }));
import { copyWithBudget } from './exportBoundedCopy';
it('preserves ENOSPC and waits for both owned handles to close', async () => {
  const inputClose = vi.fn(async () => undefined); const outputClose = vi.fn(async () => undefined);
  const diskFull = Object.assign(new Error('disk full'), { code: 'ENOSPC' });
  m.open.mockResolvedValueOnce({ stat: async () => ({ isFile: () => true, size: 1 }), read: async () => ({ bytesRead: 1 }), close: inputClose });
  m.open.mockResolvedValueOnce({ write: async () => { throw diskFull; }, close: outputClose });
  m.statfs.mockResolvedValue({ bavail: 100, bsize: 1 });
  await expect(copyWithBudget('/tmp/source', '/tmp/stage', { maxBytes: 2, minimumFreeBytes: 0 })).rejects.toMatchObject({ name: 'ExportCopyIncomplete', originalError: diskFull, retainedPath: '/tmp/stage' });
  expect(inputClose).toHaveBeenCalledOnce(); expect(outputClose).toHaveBeenCalledOnce();
});
it('keeps a close failure separate from the original ENOSPC', async () => {
  const diskFull = Object.assign(new Error('disk full'), { code: 'ENOSPC' });
  const closeFailure = new Error('close failed');
  m.open.mockResolvedValueOnce({ stat: async () => ({ isFile: () => true, size: 1 }), read: async () => ({ bytesRead: 1 }), close: async () => undefined });
  m.open.mockResolvedValueOnce({ write: async () => { throw diskFull; }, close: async () => { throw closeFailure; } });
  m.statfs.mockResolvedValue({ bavail: 100, bsize: 1 });
  await expect(copyWithBudget('/tmp/source', '/tmp/stage', { maxBytes: 2, minimumFreeBytes: 0 })).rejects.toMatchObject({ originalError: diskFull, closeErrors: [closeFailure] });
});
