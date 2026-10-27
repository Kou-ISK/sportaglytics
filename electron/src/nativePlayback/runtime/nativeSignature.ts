import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

export const NATIVE_BINARY_IDENTIFIERS = {
  NativeProductHost: 'com.kouisk.sportaglytics.native-playback-host',
  'Receiver.node': 'com.kouisk.sportaglytics.native-playback-receiver',
} as const;
type Binary = keyof typeof NATIVE_BINARY_IDENTIFIERS;
export interface NativeSigning {
  version: 1;
  teamId: string;
  files: Record<Binary, { identifier: string; sha256: string }>;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected.sort());
export const parseNativeSigning = (value: unknown): NativeSigning => {
  if (
    !record(value) ||
    !keys(value, ['version', 'teamId', 'files']) ||
    value.version !== 1 ||
    typeof value.teamId !== 'string' ||
    !/^[A-Z0-9]{10}$/.test(value.teamId) ||
    !record(value.files) ||
    !keys(value.files, Object.keys(NATIVE_BINARY_IDENTIFIERS))
  )
    throw Error('NATIVE_SIGNING_MANIFEST');
  const entry = (file: Binary): { identifier: string; sha256: string } => {
    const raw = value.files;
    if (!record(raw) || !record(raw[file])) throw Error('NATIVE_SIGNING_ENTRY');
    const item = raw[file];
    if (
      !keys(item, ['identifier', 'sha256']) ||
      item.identifier !== NATIVE_BINARY_IDENTIFIERS[file] ||
      typeof item.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.sha256)
    )
      throw Error('NATIVE_SIGNING_ENTRY');
    return { identifier: NATIVE_BINARY_IDENTIFIERS[file], sha256: item.sha256 };
  };
  return {
    version: 1,
    teamId: value.teamId,
    files: {
      NativeProductHost: entry('NativeProductHost'),
      'Receiver.node': entry('Receiver.node'),
    },
  };
};
const execute = promisify(execFile);
/** Apple Developer ID + fixed identifier; metadata never supplies requirements. */
export const verifyNativeCodeSignature = async (
  file: string,
  identifier: string,
  expectedTeam?: string,
): Promise<string> => {
  if (
    !/^com\.kouisk\.sportaglytics(?:\.native-playback-(?:host|receiver))?$/.test(
      identifier,
    ) ||
    (expectedTeam !== undefined && !/^[A-Z0-9]{10}$/.test(expectedTeam))
  )
    throw Error('NATIVE_SIGNING_POLICY');
  const requirement =
    `=anchor apple generic and identifier "${identifier}" and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists` +
    (expectedTeam
      ? ` and certificate leaf[subject.OU] = "${expectedTeam}"`
      : '');
  const options = {
    encoding: 'utf8' as const,
    timeout: 15000,
    maxBuffer: 65536,
  };
  await execute(
    '/usr/bin/codesign',
    ['--verify', '--strict', '-R', requirement, file],
    options,
  );
  const { stderr } = await execute(
    '/usr/bin/codesign',
    ['-d', '--verbose=4', file],
    options,
  );
  const team = stderr.match(/^TeamIdentifier=([A-Z0-9]{10})$/m)?.[1];
  if (
    !team ||
    (expectedTeam !== undefined && team !== expectedTeam) ||
    !/^Timestamp=/m.test(stderr) ||
    !/flags=.*\bruntime\b/.test(stderr)
  )
    throw Error('NATIVE_SIGNATURE_ATTRIBUTES');
  return team;
};
export const verifySignedNative = async (
  resources: string,
  signing: NativeSigning,
): Promise<void> => {
  const team = await verifyNativeCodeSignature(
    path.resolve(resources, '../..'),
    'com.kouisk.sportaglytics',
  );
  if (team !== signing.teamId) throw Error('NATIVE_SIGNING_TEAM');
  for (const [file, identifier] of Object.entries(NATIVE_BINARY_IDENTIFIERS))
    await verifyNativeCodeSignature(
      path.join(resources, 'native-playback', file),
      identifier,
      team,
    );
};
