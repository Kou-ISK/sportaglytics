// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>(),
);
vi.mock('electron', () => ({ app: { isPackaged: false } }));
vi.mock('../mediaTools', () => ({ getFfmpegPath: vi.fn() }));
vi.mock('../liveCapture/captureRegistry', () => ({
  assertCaptureConfigEditable: vi.fn(),
}));
vi.mock('../loopbackAudioCapture', () => ({
  authorizeLoopbackCapture: vi.fn(),
  isLoopbackAudioCaptureSupported: vi.fn(),
  revokeLoopbackCapture: vi.fn(),
}));
vi.mock('./windowSenderGuards', () => ({
  getValidatedEventSenderWindow: () => ({}),
}));
vi.mock('./registerHandleWithAliases', () => ({
  registerHandleWithAliases: (
    name: string,
    _aliases: string[],
    handler: (...args: unknown[]) => unknown,
  ) => handlers.set(name, handler),
}));

let directory: string;
let file: string;
const syncData = { syncOffset: 1, isAnalyzed: true, angleOffsets: [0, 1] };
beforeEach(async () => {
  vi.resetModules();
  handlers.clear();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-save-'));
  file = path.join(directory, 'config.json');
  const { registerSyncHandlers } = await import('./syncHandlers');
  registerSyncHandlers();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

describe('sync config persistence', () => {
  it('keeps the previous complete config until atomic replacement and preserves it on failure', async () => {
    const original = JSON.stringify({
      angles: [{ id: 'camera' }],
      extra: 'retained',
    });
    await fs.writeFile(file, original);
    const rename = vi.spyOn(fs, 'rename').mockImplementationOnce(async () => {
      expect(await fs.readFile(file, 'utf8')).toBe(original);
      throw Object.assign(new Error('synthetic failure'), { code: 'EIO' });
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await handlers.get('sync:save-data')?.({}, file, syncData)).toBe(
      false,
    );
    expect(rename).toHaveBeenCalledOnce();
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    expect(await fs.readdir(directory)).toEqual(['config.json']);
    expect(log).toHaveBeenCalled();
    rename.mockRestore();
    expect(await handlers.get('sync:save-data')?.({}, file, syncData)).toBe(
      true,
    );
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({
      angles: [{ id: 'camera' }],
      extra: 'retained',
      syncData,
    });
  });

  it.each(['', '[]', '{broken'])(
    'does not replace invalid config %j with sync data',
    async (original) => {
      await fs.writeFile(file, original);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(await handlers.get('sync:save-data')?.({}, file, syncData)).toBe(
        false,
      );
      expect(await fs.readFile(file, 'utf8')).toBe(original);
    },
  );
});
