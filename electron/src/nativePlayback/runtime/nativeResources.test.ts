import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  symlink,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveNativeResources } from './nativeResources';
import {
  NATIVE_BINARY_IDENTIFIERS,
  verifySignedNative,
} from './nativeSignature';
vi.mock('./nativeSignature', async (original) => ({
  ...(await original<typeof import('./nativeSignature')>()),
  verifySignedNative: vi.fn(async () => {}),
}));

const directories: string[] = [];
const fixture = async (): Promise<{
  root: string;
  native: string;
  state: string;
}> => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-resources-'));
  directories.push(root);
  const native = path.join(root, 'native-playback'),
    state = path.join(root, 'state');
  await mkdir(path.join(native, 'licenses'), { recursive: true });
  const files: Record<string, string> = {};
  for (const name of [
    'NativeProductHost',
    'Receiver.node',
    'licenses/FFmpeg-LGPL-2.1.txt',
    'licenses/FFmpeg-LICENSE.md',
    'licenses/Node-LICENSE.txt',
    'licenses/SporTagLytics-LICENSE.txt',
    'licenses/NOTICE.md',
  ]) {
    const bytes = Buffer.from(`synthetic ${name}`);
    await writeFile(path.join(native, name), bytes);
    files[name] = createHash('sha256').update(bytes).digest('hex');
  }
  await writeFile(
    path.join(native, 'build.json'),
    JSON.stringify({
      identity: {
        revision: 2,
        platform: 'darwin',
        architecture: 'arm64',
        napiVersion: 8,
        minimumMacOS: '13.0',
      },
      files,
    }),
  );
  return { root, native, state };
};
afterEach(async () => {
  vi.mocked(verifySignedNative).mockReset().mockResolvedValue(undefined);
  await Promise.all(
    directories
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe('fixed native resources', () => {
  it('never downgrades a normal package with missing signing metadata to unsigned', async () => {
    const f = await fixture();
    await expect(resolveNativeResources(f.root, f.state)).rejects.toThrow(
      'SIGNING',
    );
  });
  it('resolves exact qualified files without creating state or starting a process', async () => {
    const f = await fixture();
    expect(
      await resolveNativeResources(f.root, f.state, 'development'),
    ).toEqual({
      host: path.join(f.native, 'NativeProductHost'),
      receiver: path.join(f.native, 'Receiver.node'),
      state: f.state,
    });
    await expect(readFile(f.state)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects missing or additional resources', async () => {
    const f = await fixture();
    await writeFile(path.join(f.native, 'unexpected'), 'not allowed');
    await expect(
      resolveNativeResources(f.root, f.state, 'development'),
    ).rejects.toThrow('SET');
    await rm(path.join(f.native, 'unexpected'));
    await rm(path.join(f.native, 'Receiver.node'));
    await expect(
      resolveNativeResources(f.root, f.state, 'development'),
    ).rejects.toThrow('SET');
  });
  it('rejects changed helper bytes and old diagnostic build identities', async () => {
    const f = await fixture();
    await writeFile(path.join(f.native, 'NativeProductHost'), 'changed');
    await expect(
      resolveNativeResources(f.root, f.state, 'development'),
    ).rejects.toThrow('HASH');
    const file = path.join(f.native, 'build.json');
    const original = await readFile(file, 'utf8');
    await writeFile(file, original.replace('"revision":2', '"revision":1'));
    await expect(
      resolveNativeResources(f.root, f.state, 'development'),
    ).rejects.toThrow('IDENTITY');
  });
});

it('authenticates signed helpers and detects any subsequent binary change', async () => {
  const f = await fixture();
  const file = path.join(f.native, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.signing = {
    version: 1,
    teamId: 'ABCD123456',
    files: Object.fromEntries(
      Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([name, identifier]) => [
        name,
        { identifier, sha256: manifest.files[name] },
      ]),
    ),
  };
  await writeFile(file, JSON.stringify(manifest));
  await resolveNativeResources(f.root, f.state);
  expect(verifySignedNative).toHaveBeenCalledTimes(1);
  await writeFile(
    path.join(f.native, 'Receiver.node'),
    'signature changed by builder',
  );
  await expect(resolveNativeResources(f.root, f.state)).rejects.toThrow('HASH');
});
it('does not permit symlink resources or authenticated failures', async () => {
  const f = await fixture();
  const file = path.join(f.native, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.signing = {
    version: 1,
    teamId: 'ABCD123456',
    files: Object.fromEntries(
      Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([name, identifier]) => [
        name,
        { identifier, sha256: manifest.files[name] },
      ]),
    ),
  };
  await writeFile(file, JSON.stringify(manifest));
  vi.mocked(verifySignedNative).mockRejectedValueOnce(
    Error('SIGNATURE_INVALID'),
  );
  await expect(resolveNativeResources(f.root, f.state)).rejects.toThrow(
    'SIGNATURE_INVALID',
  );
  await rm(path.join(f.native, 'Receiver.node'));
  await symlink(
    path.join(f.native, 'NativeProductHost'),
    path.join(f.native, 'Receiver.node'),
  );
  await expect(
    resolveNativeResources(f.root, f.state, 'development'),
  ).rejects.toThrow('BOUND');
});
