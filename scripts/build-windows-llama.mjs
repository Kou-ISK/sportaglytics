import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadVerified, hashFile } from './download-verified.mjs';
import { run } from './media-tools/process.mjs';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error(
    'Build llama.cpp on Windows x64 with Visual Studio C++ build tools.',
  );
const version = 'b7849';
const sourceHash =
  '6a18527b93c78af01f8efd41f3e5703b5c3bddf22f68abfae1fd743f0fd26e29';
const output = resolve('.cache/llama/win32-x64');
const identity = { version, sourceHash, revision: 2, target: 'win32-x64' };
try {
  const manifest = JSON.parse(
    await readFile(join(output, 'build.json'), 'utf8'),
  );
  if (
    JSON.stringify(manifest.identity) === JSON.stringify(identity) &&
    (await hashFile(join(output, 'llama-completion.exe'))) === manifest.sha256
  ) {
    console.log('Verified cached Windows llama.cpp');
    process.exit(0);
  }
} catch {
  /* Build a missing or invalid cache. */
}
const archive = resolve('.cache/llama', `${version}.tar.gz`);
await downloadVerified(
  `https://github.com/ggml-org/llama.cpp/archive/refs/tags/${version}.tar.gz`,
  archive,
  sourceHash,
);
const temporary = await mkdtemp(join(tmpdir(), 'sportaglytics-llama-'));
try {
  await run('tar', ['-xf', archive, '-C', temporary]);
  const source = join(temporary, `llama.cpp-${version}`);
  const build = join(temporary, 'build');
  await run('cmake', [
    '-S',
    source,
    '-B',
    build,
    '-A',
    'x64',
    '-DCMAKE_POLICY_DEFAULT_CMP0091=NEW',
    '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded',
    '-DBUILD_SHARED_LIBS=OFF',
    '-DGGML_STATIC=ON',
    '-DGGML_NATIVE=OFF',
    '-DGGML_OPENMP=OFF',
    '-DGGML_AVX=OFF',
    '-DGGML_AVX2=OFF',
    '-DGGML_FMA=OFF',
    '-DGGML_F16C=OFF',
    '-DLLAMA_CURL=OFF',
    '-DLLAMA_BUILD_TESTS=OFF',
    '-DLLAMA_BUILD_SERVER=OFF',
  ]);
  await run('cmake', [
    '--build',
    build,
    '--config',
    'Release',
    '--target',
    'llama-completion',
    '--parallel',
    '4',
  ]);
  await mkdir(output, { recursive: true });
  // Static C++ runtime and baseline x64 instructions avoid external VC++/OpenMP dependencies.
  const executable = join(output, 'llama-completion.exe');
  await copyFile(
    join(build, 'bin', 'Release', 'llama-completion.exe'),
    executable,
  );
  const licenses = join(output, 'licenses');
  await mkdir(licenses, { recursive: true });
  await copyFile(join(source, 'LICENSE'), join(licenses, 'llama.cpp-LICENSE'));
  for (const name of await readdir(join(source, 'licenses'))) {
    await copyFile(join(source, 'licenses', name), join(licenses, name));
  }
  await run(executable, ['--version']);
  await writeFile(
    join(output, 'build.json'),
    JSON.stringify({ identity, sha256: await hashFile(executable) }, null, 2),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
