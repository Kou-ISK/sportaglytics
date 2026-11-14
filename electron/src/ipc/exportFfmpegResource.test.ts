// @vitest-environment node
import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ spawn: vi.fn(), lstat: vi.fn() }));
vi.mock('child_process', () => ({ spawn: m.spawn }));
vi.mock('node:fs/promises', async (original) => ({ ...(await original<typeof import('node:fs/promises')>()), lstat: m.lstat }));
import { runFfmpegProcess } from './exportFfmpegProcess';
import { exportResourceContext, type ExportResources } from './exportResourceContext';
const fakeChild = () => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(), pid: 5 });
it('checks the final candidate even when the child completes before its first timer', async () => {
 const c = fakeChild(); m.spawn.mockReturnValue(c); m.lstat.mockResolvedValue({ isFile: () => true, size: 11 });
 const r: ExportResources = { signal: new AbortController().signal, maxFileBytes: 10, minFreeBytes: 0, check: async () => undefined };
 const result = exportResourceContext.run(r, () => runFfmpegProcess(() => 'ffmpeg', ['output']));
 await vi.waitFor(() => expect(m.spawn).toHaveBeenCalled()); c.emit('close', 0, null);
 await expect(result).rejects.toThrow('容量上限');
});
it('does not treat a missing final candidate as success', async () => {
 const c = fakeChild(); m.spawn.mockReturnValue(c); m.lstat.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
 const r: ExportResources = { signal: new AbortController().signal, maxFileBytes: 10, minFreeBytes: 0, check: async () => undefined };
 const result = exportResourceContext.run(r, () => runFfmpegProcess(() => 'ffmpeg', ['output']));
 await vi.waitFor(() => expect(m.spawn).toHaveBeenCalled()); c.emit('close', 0, null);
 await expect(result).rejects.toThrow('missing');
});
