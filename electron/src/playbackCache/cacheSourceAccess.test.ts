import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { assertClosedMp4, resolveCacheSource } from './cacheSourceAccess';
vi.mock('../liveCapture/captureRegistry', () => ({
  isPackageCaptureActive: () => false,
}));
vi.mock('../ipc/packageUpdateLeases', () => ({
  isPackageUpdating: () => false,
}));
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-source-test-'));
  roots.push(root);
  await fs.mkdir(path.join(root, '.metadata'));
  await fs.mkdir(path.join(root, 'videos'));
  const source = path.join(root, 'videos/source.mp4');
  await fs.writeFile(source, 'source');
  const config = path.join(root, '.metadata/config.json');
  const data = {
    angles: [
      {
        id: 'angle',
        clips: [
          {
            id: 'clip',
            sourceKind: 'local',
            relativePath: 'videos/source.mp4',
          },
        ],
      },
    ],
  };
  await fs.writeFile(config, JSON.stringify(data));
  return { root, source, config, data };
};
it('binds configuration and source revision without modifying either', async () => {
  const { root, config, source } = await fixture();
  const authorized = await resolveCacheSource(root);
  await authorized.assertCurrent();
  expect(authorized.url).toContain('/videos/source.mp4');
  await fs.writeFile(config, '{}');
  await expect(authorized.assertCurrent()).rejects.toThrow();
  expect(await fs.readFile(source, 'utf8')).toBe('source');
});
it('rejects blob/live-style paths, outside-package paths and symlink sources', async () => {
  const { root, config, source, data } = await fixture();
  for (const relative of ['../outside.mp4', 'blob:recording', '/outside.mp4']) {
    data.angles[0].clips[0].relativePath = relative;
    await fs.writeFile(config, JSON.stringify(data));
    await expect(resolveCacheSource(root)).rejects.toThrow();
  }
  data.angles[0].clips[0].relativePath = 'videos/source.mp4';
  await fs.writeFile(config, JSON.stringify(data));
  await fs.rename(source, source + '.original');
  await fs.symlink(source + '.original', source);
  await expect(resolveCacheSource(root)).rejects.toThrow('CACHE_UNSAFE_SOURCE');
});
it('rejects fragmented containers and cancelled reads before any media process starts', async () => {
  const { source } = await fixture();
  const bytes = Buffer.alloc(8);
  bytes.writeUInt32BE(8);
  bytes.write('moof', 4);
  await fs.writeFile(source, bytes);
  await expect(assertClosedMp4(source)).rejects.toThrow(
    'CACHE_FRAGMENTED_SOURCE',
  );
  const controller = new AbortController();
  controller.abort();
  await expect(assertClosedMp4(source, controller.signal)).rejects.toThrow();
});
