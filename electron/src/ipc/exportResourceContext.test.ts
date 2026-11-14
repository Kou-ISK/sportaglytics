// @vitest-environment node
import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ statfs: vi.fn(), stat: vi.fn() }));
vi.mock('node:fs/promises', () => ({ statfs: m.statfs, stat: m.stat }));
import { createExportResources, exportResourceContext } from './exportResourceContext';
it('owns a finite threshold and propagates cancellation', async () => {
 m.statfs.mockResolvedValue({ bavail: 3 * 1024 ** 3, bsize: 1 });
 m.stat.mockResolvedValue({ dev: 1 });
 const controller = new AbortController(); const resource = await createExportResources('/tmp/out', controller.signal);
 await resource.check(); expect(resource.maxFileBytes).toBe(512 * 1024 ** 2);
 expect(exportResourceContext.run(resource, () => exportResourceContext.getStore())).toBe(resource);
 controller.abort(); await expect(resource.check()).rejects.toMatchObject({ name: 'AbortError' });
});
it('stops on insufficient or unreadable free space', async () => {
 m.stat.mockResolvedValue({ dev: 1 });
 m.statfs.mockResolvedValue({ bavail: 1, bsize: 1 });
 await expect(createExportResources('/tmp/out', new AbortController().signal)).rejects.toThrow();
 m.statfs.mockRejectedValue(Object.assign(new Error('unavailable'), { code: 'EIO' }));
 await expect(createExportResources('/tmp/out', new AbortController().signal)).rejects.toThrow();
});

it('does not impose the native 8 GiB cap on FFmpeg when sufficient space exists', async () => {
 m.stat.mockResolvedValue({ dev: 1 });
 m.statfs.mockResolvedValue({ bavail: 40 * 1024 ** 3, bsize: 1 });
 const resource = await createExportResources('/tmp/out', new AbortController().signal);
 expect(resource.maxFileBytes).toBe(19 * 1024 ** 3);
});

it('does not halve the budget when the volumes are distinct', async () => {
 m.stat.mockImplementation(async (directory: string) => ({ dev: directory === '/tmp/out' ? 2 : 1 }));
 m.statfs.mockResolvedValue({ bavail: 40 * 1024 ** 3, bsize: 1 });
 const resource = await createExportResources('/tmp/out', new AbortController().signal);
 expect(resource.maxFileBytes).toBe(38 * 1024 ** 3);
});
it('allows one destination candidate rather than budgeting a duplicate on the same volume', async () => {
 m.stat.mockResolvedValue({ dev: 1 });
 m.statfs.mockResolvedValue({ bavail: 50_000_000_000, bsize: 1 });
 const resource = await createExportResources('/tmp/out', new AbortController().signal, 30_000_000_000, true);
 expect(resource.maxFileBytes).toBe(20_000_000_000);
});
it('uses the single-candidate threshold for the actual reserve, on same and separate devices', async () => {
 const reserve = 6 * 1024 ** 3 + 2_424_312_035;
 m.stat.mockResolvedValue({ dev: 1 });
 m.statfs.mockResolvedValue({ bavail: reserve + 24_243_120_350, bsize: 1 });
 const same = await createExportResources('/tmp/out', new AbortController().signal, reserve, true);
 expect(same.maxFileBytes).toBe(24_243_120_350);
 m.stat.mockImplementation(async (directory: string) => ({ dev: directory === '/tmp/out' ? 2 : 1 }));
 const separate = await createExportResources('/tmp/out', new AbortController().signal, reserve, true);
 expect(separate.maxFileBytes).toBe(24_243_120_350);
 m.statfs.mockResolvedValue({ bavail: reserve, bsize: 1 });
 await expect(createExportResources('/tmp/out', new AbortController().signal, reserve, true)).rejects.toThrow();
});
