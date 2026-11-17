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
import { resolveNativeResources, resolveVerifiedNativeResources, resolveSignedNativeGroupResources } from './nativeResources';
import { probeNativeGroupCapability } from './groupCapability';
import {
  NATIVE_BINARY_IDENTIFIERS,
  verifySignedNative,
} from './nativeSignature';
vi.mock('./nativeSignature', async (original) => ({
  ...(await original<typeof import('./nativeSignature')>()),
  verifySignedNative: vi.fn(async () => {}),
}));
vi.mock('./groupCapability', () => ({ probeNativeGroupCapability: vi.fn() }));

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
    'CommandLeft.node',
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
        revision: 8,
        engine: 'AVPlayer',
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
  vi.mocked(probeNativeGroupCapability).mockReset();
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
    for (const revision of [1, 2, 3, 4, 5, 6, 7, 10]) {
      await writeFile(
        file,
        original.replace('"revision":8', `"revision":${revision}`),
      );
      await expect(
        resolveNativeResources(f.root, f.state, 'development'),
      ).rejects.toThrow('IDENTITY');
    }
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
it('rejects a modified command-input addon even when other resources match', async () => {
  const f = await fixture();
  await writeFile(path.join(f.native, 'CommandLeft.node'), 'modified');
  await expect(
    resolveNativeResources(f.root, f.state, 'development'),
  ).rejects.toThrow('HASH');
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

it('admits revision 9 only after signature and resource hashes are verified', async () => {
  const f = await fixture(); const file = path.join(f.native, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8')); manifest.identity.revision = 9;
  manifest.signing = { version: 1, teamId: 'ABCD123456', files: Object.fromEntries(Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([name, identifier]) => [name, { identifier, sha256: manifest.files[name] }])) };
  await writeFile(file, JSON.stringify(manifest));
  const verified = await resolveVerifiedNativeResources(f.root, f.state);
  expect(verified.revision).toBe(9); expect(verifySignedNative).toHaveBeenCalled();
  await writeFile(path.join(f.native, 'NativeProductHost'), 'mutated');
  await expect(resolveVerifiedNativeResources(f.root, f.state)).rejects.toThrow('HASH');
});

it('does not launch a group probe before signature/hash validation', async () => {
  const f = await fixture();
  await expect(resolveSignedNativeGroupResources(f.root, f.state,
    new AbortController().signal)).rejects.toThrow('SIGNING');
  expect(probeNativeGroupCapability).not.toHaveBeenCalled();
  const file = path.join(f.native, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.signing = { version: 1, teamId: 'ABCD123456', files:
    Object.fromEntries(Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([name, identifier]) =>
      [name, { identifier, sha256: manifest.files[name] }])) };
  await writeFile(file, JSON.stringify(manifest));
  await writeFile(path.join(f.native, 'NativeProductHost'), 'mutated');
  await expect(resolveSignedNativeGroupResources(f.root, f.state,
    new AbortController().signal)).rejects.toThrow('HASH');
  expect(probeNativeGroupCapability).not.toHaveBeenCalled();
});

it('requires the explicit group response even for a verified revision 9', async () => {
  const f = await fixture(), file = path.join(f.native, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.identity.revision = 9;
  manifest.signing = { version: 1, teamId: 'ABCD123456', files:
    Object.fromEntries(Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([name, identifier]) =>
      [name, { identifier, sha256: manifest.files[name] }])) };
  await writeFile(file, JSON.stringify(manifest));
  const signal = new AbortController().signal;
  vi.mocked(probeNativeGroupCapability).mockRejectedValueOnce(Error('old helper'));
  await expect(resolveSignedNativeGroupResources(f.root, f.state, signal)).rejects.toThrow('old helper');
  expect(probeNativeGroupCapability).toHaveBeenCalledWith(path.join(f.native, 'NativeProductHost'), signal);
  const capability = { version: 1, transport: 2, mode: 'placed-pair-decoded-samples',
    angles: 2, clipsPerAngle: 1, timescale: 120000, imageBudgetBytes: 536870912,
    stopAuthority: 'submitted-pair-v1' } as const;
  vi.mocked(probeNativeGroupCapability).mockResolvedValueOnce(capability);
  await expect(resolveSignedNativeGroupResources(f.root, f.state, signal)).resolves.toEqual({
    paths: { host: path.join(f.native, 'NativeProductHost'),
      receiver: path.join(f.native, 'Receiver.node'), state: f.state }, capability,
  });
  expect(verifySignedNative).toHaveBeenCalled();
});

it('does not start a group probe if cancellation arrives during signature validation', async () => {
  const f = await fixture(), file = path.join(f.native, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.signing = { version: 1, teamId: 'ABCD123456', files:
    Object.fromEntries(Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([name, identifier]) =>
      [name, { identifier, sha256: manifest.files[name] }])) };
  await writeFile(file, JSON.stringify(manifest));
  const signal = new AbortController();
  vi.mocked(verifySignedNative).mockImplementationOnce(async () => { signal.abort(); });
  await expect(resolveSignedNativeGroupResources(f.root, f.state, signal.signal)).rejects.toThrow();
  expect(probeNativeGroupCapability).not.toHaveBeenCalled();
});
