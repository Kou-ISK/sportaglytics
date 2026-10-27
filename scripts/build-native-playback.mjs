import { execFileSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadVerified } from './download-verified.mjs';
import { downloadSourceArchive } from './media-tools/source-download.mjs';
import { run } from './media-tools/process.mjs';
import {
  BUILD_REVISION,
  BUILD_INPUT_FILES,
  FRAMEWORKS,
  HOST_SOURCES,
  MINIMUM_MACOS,
  NODE_LICENSE,
  UPSTREAM,
} from './native-playback/recipe.mjs';
import {
  hashFiles,
  PAYLOAD_FILES,
  verifyNativeBuild,
} from './native-playback/manifest.mjs';

if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw Error('Native playback preview is currently macOS arm64 only');
const project = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = join(project, 'native/macos/playback');
const cache = join(project, '.cache/native-playback');
const output = join(cache, 'darwin-arm64');
const sourceFiles = JSON.parse(
  await readFile(join(sourceRoot, 'source-files.json'), 'utf8'),
);
const recipeFiles = BUILD_INPUT_FILES;
const capture = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  }).trim();
const sdkPath = capture('xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
const identity = {
  revision: BUILD_REVISION,
  platform: 'darwin',
  architecture: 'arm64',
  minimumMacOS: MINIMUM_MACOS,
  sources: UPSTREAM,
  nodeLicense: NODE_LICENSE,
  inputHashes: await hashFiles(sourceRoot, sourceFiles),
  recipeHashes: await hashFiles(project, recipeFiles),
  toolchain: {
    compiler: capture('xcrun', ['clang++', '--version']).split('\n')[0],
    sdkVersion: capture('xcrun', ['--sdk', 'macosx', '--show-sdk-version']),
    sdkBuild: capture('xcrun', ['--sdk', 'macosx', '--show-sdk-build-version']),
  },
  engine: 'AVPlayer',
  napiVersion: 8,
};
try {
  await verifyNativeBuild(output, identity);
  console.log('Verified native playback build cache');
  process.exit(0);
} catch {
  /* A missing/stale cache is rebuilt from its complete inputs. */
}
await mkdir(cache, { recursive: true });
const lock = join(cache, 'build.lock');
await mkdir(lock); // Exclusive ownership; do not clear another build's lock.
let work;
try {
  work = await mkdtemp(join(cache, 'work-'));
  const stage = join(work, 'payload');
  await mkdir(join(stage, 'licenses'), { recursive: true });
  // Compile a verified snapshot, never mutable checkout files. Check the
  // original inputs again before publishing to catch concurrent edits.
  const snapshot = join(work, 'native-source');
  for (const file of sourceFiles) {
    const destination = join(snapshot, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(sourceRoot, file), destination);
  }
  if (
    JSON.stringify(await hashFiles(snapshot, sourceFiles)) !==
    JSON.stringify(identity.inputHashes)
  )
    throw Error('Native inputs changed while snapshotting');
  const sources = {};
  const nodeLicense = join(cache, 'source/node-v22.12.0-LICENSE');
  await downloadVerified(NODE_LICENSE.url, nodeLicense, NODE_LICENSE.sha256);
  for (const [name, source] of Object.entries(UPSTREAM)) {
    const archive = join(cache, 'source', basename(source.url));
    await downloadSourceArchive(source, archive);
    await run('tar', ['-xf', archive, '-C', work]);
    sources[name] = join(work, source.directory);
  }
  const common = [
    'clang++',
    '-std=c++17',
    '-O2',
    '-arch',
    'arm64',
    `-mmacosx-version-min=${MINIMUM_MACOS}`,
    '-fobjc-arc',
    '-fblocks',
    `-ffile-prefix-map=${resolve(work)}=/native-build`,
    `-ffile-prefix-map=${resolve(snapshot)}=/native-source`,
    '-isysroot',
    sdkPath,
  ];
  await run('xcrun', [
    ...common,
    ...HOST_SOURCES.map((file) => join(snapshot, file)),
    ...FRAMEWORKS.flatMap((name) => ['-framework', name]),
    '-lbsm',
    '-o',
    join(stage, 'NativeProductHost'),
  ]);
  await run('xcrun', [
    ...common,
    '-DNAPI_VERSION=8',
    '-DNODE_GYP_MODULE_NAME=Receiver',
    '-bundle',
    '-undefined',
    'dynamic_lookup',
    `-I${join(sources.node, 'include/node')}`,
    join(snapshot, 'surface-transport/Receiver.mm'),
    '-framework',
    'IOSurface',
    '-framework',
    'Foundation',
    '-lbsm',
    '-o',
    join(stage, 'Receiver.node'),
  ]);
  for (const file of ['NativeProductHost', 'Receiver.node']) {
    if (capture('lipo', ['-archs', join(stage, file)]) !== 'arm64')
      throw Error('Native architecture mismatch');
    const linked = capture('otool', ['-L', join(stage, file)])
      .split('\n')
      .slice(1);
    if (
      linked.some(
        (line) =>
          !/^\s+\/(?:System\/Library\/Frameworks\/|usr\/lib\/)/.test(line),
      )
    )
      throw Error(`Non-system native dependency: ${file}`);
  }
  for (const [from, to] of [
    [nodeLicense, 'Node-LICENSE.txt'],
    [join(project, 'LICENSE'), 'SporTagLytics-LICENSE.txt'],
    [join(sourceRoot, 'NOTICE.md'), 'NOTICE.md'],
  ])
    await copyFile(from, join(stage, 'licenses', to));
  const files = await hashFiles(
    stage,
    PAYLOAD_FILES.filter((file) => file !== 'build.json'),
  );
  const manifest = {
    identity,
    files,
  };
  await writeFile(
    join(stage, 'build.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await verifyNativeBuild(stage, identity);
  if (
    JSON.stringify(await hashFiles(sourceRoot, sourceFiles)) !==
      JSON.stringify(identity.inputHashes) ||
    JSON.stringify(await hashFiles(project, recipeFiles)) !==
      JSON.stringify(identity.recipeHashes)
  )
    throw Error('Native source or recipe changed during build');
  // Only replace this build tool's generated cache after a complete verified build.
  await rm(output, { recursive: true, force: true });
  await rename(stage, output);
  console.log('Built verified native playback helper and N-API receiver');
} finally {
  try {
    if (work) await rm(work, { recursive: true, force: true });
  } finally {
    await rm(lock, { recursive: true });
  }
}
