import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const prefix = 'mingw-w64-ucrt-x86_64-';
export const TOOLCHAIN_NOTICES = Object.freeze({
  libgcc: ['COPYING3', 'COPYING.RUNTIME'],
  'libstdc++': ['COPYING3', 'COPYING.RUNTIME'],
  crt: ['COPYING', 'COPYING.MinGW-w64.txt', 'COPYING.MinGW-w64-runtime.txt'],
  headers: [
    'COPYING',
    'COPYING.MinGW-w64.txt',
    'COPYING.MinGW-w64-runtime.txt',
    'ddk-readme.txt',
  ],
  winpthreads: ['COPYING'],
  libwinpthread: ['COPYING'],
});
const paths = Object.entries(TOOLCHAIN_NOTICES).flatMap(([pkg, files]) =>
  files.map((name) => `${pkg}/${name}`),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const captureCommand = async (command, args) =>
  (
    await promisify(execFile)(command, args, {
      windowsHide: true,
      encoding: 'utf8',
    })
  ).stdout.trim();

export const validateToolchainRecord = (record) => {
  if (
    record?.schemaVersion !== 1 ||
    typeof record.compilerVersion !== 'string' ||
    !/^\d+\.\d+(?:\.\d+)?$/.test(record.compilerVersion ?? '') ||
    Object.keys(record.packages ?? {})
      .sort()
      .join() !== Object.keys(TOOLCHAIN_NOTICES).sort().join() ||
    Object.keys(record.files ?? {})
      .sort()
      .join() !== [...paths].sort().join()
  )
    throw new Error('Incomplete Windows compiler runtime notice inventory');
  for (const version of Object.values(record.packages))
    if (typeof version !== 'string' || !/^\d[\w.+:-]{0,127}$/.test(version))
      throw new Error('Invalid Windows toolchain package version');
  for (const digest of Object.values(record.files))
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest))
      throw new Error('Invalid Windows toolchain notice hash');
  for (const name of ['libgcc', 'libstdc++'])
    if (
      record.packages[name].replace(/^\d+:/, '').split('-')[0] !==
      record.compilerVersion
    )
      throw new Error('Compiler and runtime package versions disagree');
  // Do not export command output, local installation paths or extra metadata.
  return {
    schemaVersion: 1,
    compilerVersion: record.compilerVersion,
    packages: Object.fromEntries(
      Object.keys(TOOLCHAIN_NOTICES).map((name) => [
        name,
        record.packages[name],
      ]),
    ),
    files: Object.fromEntries(paths.map((path) => [path, record.files[path]])),
  };
};

export const copyWindowsToolchainNotices = async (
  output,
  { capture = captureCommand } = {},
) => {
  const compilerVersion = await capture('gcc', ['-dumpfullversion']);
  const licenseRoot = await capture('cygpath', [
    '-w',
    '/ucrt64/share/licenses',
  ]);
  const packages = {};
  for (const name of Object.keys(TOOLCHAIN_NOTICES)) {
    const installed = (
      await capture('pacman', ['-Q', `${prefix}${name}`])
    ).split(/\s+/);
    if (installed.length !== 2 || installed[0] !== `${prefix}${name}`)
      throw new Error(`Cannot identify installed toolchain package: ${name}`);
    packages[name] = installed[1];
  }
  const files = {};
  const texts = {};
  for (const path of paths) {
    const bytes = await readFile(join(licenseRoot, path));
    if (!bytes.toString('utf8').trim())
      throw new Error(`Empty toolchain notice: ${path}`);
    files[path] = hash(bytes);
    texts[path] = bytes;
  }
  const record = validateToolchainRecord({
    schemaVersion: 1,
    compilerVersion,
    packages,
    files,
  });
  const root = join(output, 'licenses/toolchain');
  for (const [path, bytes] of Object.entries(texts)) {
    const [directory] = path.split('/');
    await mkdir(join(root, directory), { recursive: true });
    await writeFile(join(root, path), bytes);
  }
  await writeFile(
    join(root, 'manifest.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  return record;
};

export const verifyWindowsToolchainNotices = async (output, expected) => {
  const root = join(output, 'licenses/toolchain');
  const record = validateToolchainRecord(
    JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')),
  );
  const build =
    expected ??
    JSON.parse(await readFile(join(output, 'build.json'), 'utf8')).toolchain;
  if (JSON.stringify(record) !== JSON.stringify(validateToolchainRecord(build)))
    throw new Error(
      'Windows toolchain notices do not match the binary build record',
    );
  for (const [path, expected] of Object.entries(record.files)) {
    const bytes = await readFile(join(root, path));
    if (!bytes.toString('utf8').trim() || hash(bytes) !== expected)
      throw new Error(`Changed Windows compiler runtime notice: ${path}`);
  }
  return record;
};
