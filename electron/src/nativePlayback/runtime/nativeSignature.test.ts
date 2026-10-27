import { afterEach, expect, it, vi } from 'vitest';
import path from 'node:path';
import {
  NATIVE_BINARY_IDENTIFIERS,
  parseNativeSigning,
  verifyNativeCodeSignature,
  verifySignedNative,
} from './nativeSignature';
const execute = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({
  execFile: Object.assign(() => {}, {
    [Symbol.for('nodejs.util.promisify.custom')]: execute,
  }),
}));
afterEach(() => vi.resetAllMocks());
const fixture = () => ({
  version: 1,
  teamId: 'ABCD123456',
  files: Object.fromEntries(
    Object.entries(NATIVE_BINARY_IDENTIFIERS).map(([file, identifier]) => [
      file,
      { identifier, sha256: 'a'.repeat(64) },
    ]),
  ),
});
const signature = (
  team = 'ABCD123456',
): { stdout: string; stderr: string } => ({
  stdout: '',
  stderr: `TeamIdentifier=${team}\nTimestamp=synthetic\nCodeDirectory flags=0x10000(runtime)\n`,
});
it('requires an exact signed manifest and fixed identifiers', () => {
  const raw = fixture();
  expect(parseNativeSigning(raw).teamId).toBe(raw.teamId);
  for (const bad of [
    null,
    {},
    { ...raw, version: 2 },
    { ...raw, extra: true },
    { ...raw, teamId: 'bad' },
    { ...raw, files: {} },
  ])
    expect(() => parseNativeSigning(bad)).toThrow('SIGNING');
  raw.files.NativeProductHost.identifier = 'com.other.host';
  expect(() => parseNativeSigning(raw)).toThrow('ENTRY');
});
it('rejects altered metadata keys and non-hash values', () => {
  const raw = fixture();
  raw.files.NativeProductHost.sha256 = 'bad';
  expect(() => parseNativeSigning(raw)).toThrow('ENTRY');
  expect(() =>
    parseNativeSigning({
      ...fixture(),
      files: { ...fixture().files, unexpected: {} },
    }),
  ).toThrow('MANIFEST');
});
it('authenticates the enclosing app before matching both helpers to its team', async () => {
  execute.mockResolvedValue(signature());
  const appRoot = path.resolve('synthetic', 'SporTagLytics.app');
  await verifySignedNative(
    path.join(appRoot, 'Contents', 'Resources'),
    parseNativeSigning(fixture()),
  );
  expect(execute).toHaveBeenCalledTimes(6);
  expect(execute.mock.calls[0][1]).toContain(appRoot);
  expect(execute.mock.calls[0][1][3]).toContain('anchor apple generic');
  expect(execute.mock.calls[2][1][3]).toContain(
    'certificate leaf[subject.OU] = "ABCD123456"',
  );
  expect(execute.mock.calls[4][1][3]).toContain(
    NATIVE_BINARY_IDENTIFIERS['Receiver.node'],
  );
  expect(execute.mock.calls[0][2]).toMatchObject({
    timeout: 15000,
    maxBuffer: 65536,
  });
});
it('rejects metadata from a different team before verifying or trusting helpers', async () => {
  execute.mockResolvedValue(signature('OTHER12345'));
  await expect(
    verifySignedNative(
      '/synthetic/App.app/Contents/Resources',
      parseNativeSigning(fixture()),
    ),
  ).rejects.toThrow('TEAM');
  expect(execute).toHaveBeenCalledTimes(2);
});
it('rejects invalid signatures without attempting unsigned recovery', async () => {
  execute.mockRejectedValue(Error('invalid signature'));
  await expect(
    verifySignedNative(
      '/synthetic/App.app/Contents/Resources',
      parseNativeSigning(fixture()),
    ),
  ).rejects.toThrow('invalid signature');
  expect(execute).toHaveBeenCalledTimes(1);
});
it.each([
  'TeamIdentifier=ABCD123456\nTimestamp=synthetic',
  'TeamIdentifier=ABCD123456\nflags=runtime',
  'TeamIdentifier=bad\nTimestamp=synthetic\nflags=runtime',
])('requires timestamp, runtime and team: %s', async (stderr) => {
  execute.mockResolvedValue({ stdout: '', stderr });
  await expect(
    verifyNativeCodeSignature(
      '/synthetic/host',
      NATIVE_BINARY_IDENTIFIERS.NativeProductHost,
    ),
  ).rejects.toThrow('ATTRIBUTES');
});
