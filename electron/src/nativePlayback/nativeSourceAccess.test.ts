import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { resolveNativeSource } from './nativeSourceAccess';

const roots: string[] = [];
const fixture = async (): Promise<{
  root: string;
  source: string;
  config: string;
}> => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'native-source-')),
  );
  roots.push(root);
  await fs.mkdir(path.join(root, '.metadata'));
  const source = path.join(root, 'source.mp4'),
    config = path.join(root, '.metadata/config.json');
  await fs.writeFile(source, 'synthetic file identity only');
  await fs.writeFile(
    config,
    JSON.stringify({
      angles: [
        {
          id: 'a',
          sourceKind: 'local',
          clips: [
            {
              id: 'c',
              sourceKind: 'local',
              relativePath: 'source.mp4',
              timelineStartSeconds: 0,
            },
          ],
        },
      ],
    }),
  );
  return { root, source, config };
};
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});
it('uses bounded current package metadata and detects source replacement', async () => {
  const f = await fixture(),
    s = await resolveNativeSource(f.root);
  expect(s.path).toBe(f.source);
  await s.assertCurrent();
  await fs.writeFile(f.source, 'replacement');
  await expect(s.assertCurrent()).rejects.toThrow('NATIVE_SOURCE_CHANGED');
});
it('rejects metadata replacement and symlink source', async () => {
  const f = await fixture(),
    s = await resolveNativeSource(f.root);
  await fs.appendFile(f.config, ' ');
  await expect(s.assertCurrent()).rejects.toThrow('NATIVE_SOURCE_CHANGED');
  await fs.rename(f.source, f.source + '.bak');
  await fs.symlink(f.source + '.bak', f.source);
  await expect(resolveNativeSource(f.root)).rejects.toThrow(
    'NATIVE_SOURCE_SYMLINK',
  );
});
it('retains an existing absolute local reference without reading media contents', async () => {
  const f = await fixture(),
    external = await fixture();
  const raw = JSON.parse(await fs.readFile(f.config, 'utf8'));
  raw.angles[0].clips[0].relativePath = external.source;
  await fs.writeFile(f.config, JSON.stringify(raw));
  expect((await resolveNativeSource(f.root)).path).toBe(external.source);
  raw.angles[0].clips[0].relativePath = '../outside.mp4';
  await fs.writeFile(f.config, JSON.stringify(raw));
  await expect(resolveNativeSource(f.root)).rejects.toThrow(
    'NATIVE_UNSUPPORTED_SOURCE',
  );
});
it('rejects multiple clips, timeline offsets, and excessive metadata', async () => {
  const f = await fixture(),
    raw = JSON.parse(await fs.readFile(f.config, 'utf8'));
  raw.angles[0].clips[0].timelineStartSeconds = 1;
  await fs.writeFile(f.config, JSON.stringify(raw));
  await expect(resolveNativeSource(f.root)).rejects.toThrow(
    'NATIVE_UNSUPPORTED_PACKAGE',
  );
  raw.angles[0].clips.push(raw.angles[0].clips[0]);
  await fs.writeFile(f.config, JSON.stringify(raw));
  await expect(resolveNativeSource(f.root)).rejects.toThrow();
  await fs.writeFile(f.config, ' '.repeat(1024 * 1024 + 1));
  await expect(resolveNativeSource(f.root)).rejects.toThrow(
    'NATIVE_CONFIG_LIMIT',
  );
});

it('retains the validated package endpoint separately from later video qualification', async () => {
  const f = await fixture();
  expect((await resolveNativeSource(f.root)).sourceEnd).toBeNull();
  const raw = JSON.parse(await fs.readFile(f.config, 'utf8'));
  raw.angles[0].clips[0].durationSeconds = 20.00020033333333;
  await fs.writeFile(f.config, JSON.stringify(raw));
  const source = await resolveNativeSource(f.root);
  expect(source.sourceEnd).toBe(20.00020033333333);
  await source.assertCurrent();
  raw.angles[0].clips[0].durationSeconds = 20;
  await fs.writeFile(f.config, JSON.stringify(raw));
  await expect(source.assertCurrent()).rejects.toThrow('NATIVE_SOURCE_CHANGED');
  for (const invalid of [-1, 0, 86401, '20', null]) {
    raw.angles[0].clips[0].durationSeconds = invalid;
    await fs.writeFile(f.config, JSON.stringify(raw));
    await expect(resolveNativeSource(f.root)).rejects.toThrow();
  }
});
