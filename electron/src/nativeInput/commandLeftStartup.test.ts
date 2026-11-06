import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSignedCommandLeftMonitor } from './commandLeftStartup';
import { resolveSignedCommandInput } from '../nativePlayback/runtime/nativeResources';
vi.mock('../nativePlayback/runtime/nativeResources', () => ({ resolveSignedCommandInput: vi.fn() }));
const directories: string[] = [];
afterEach(async () => { vi.resetAllMocks(); await Promise.all(directories.splice(0).map((p) => rm(p, { recursive: true, force: true }))); });
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')('loads only the path returned by signed resource verification', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'command-startup-')); directories.push(directory);
  const file = path.join(directory, 'synthetic.cjs');
  await writeFile(file, 'module.exports={start(){},stop(){},reset(){return 0},health(){return {}},matchesWindow(){return true}}');
  vi.mocked(resolveSignedCommandInput).mockResolvedValue(file);
  const monitor = await loadSignedCommandLeftMonitor('/resources', '/state');
  expect(resolveSignedCommandInput).toHaveBeenCalledWith('/resources', '/state');
  expect(monitor.reset()).toBe(0);
  expect(monitor.matchesWindow(Buffer.alloc(8), 1)).toBe(true);
});
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')('does not load an addon when signed verification fails', async () => {
  vi.mocked(resolveSignedCommandInput).mockRejectedValue(Error('SIGNATURE_INVALID'));
  await expect(loadSignedCommandLeftMonitor('/resources', '/state')).rejects.toThrow('SIGNATURE_INVALID');
});
