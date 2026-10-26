import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { hashFile } from './download-verified.mjs';
import { run } from './media-tools/process.mjs';
import {
  UPSTREAM,
  NODE_LICENSE,
  BUILD_INPUT_FILES,
} from './native-playback/recipe.mjs';
import { hashFiles, verifyNativeBuild } from './native-playback/manifest.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const cache = join(project, '.cache/native-playback');
const build = join(cache, 'darwin-arm64');
const manifestBytes = await readFile(join(build, 'build.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const manifestHash = createHash('sha256').update(manifestBytes).digest('hex');
await verifyNativeBuild(build, manifest.identity);
const sourceFiles = JSON.parse(
  await readFile(
    join(project, 'native/macos/playback/source-files.json'),
    'utf8',
  ),
);
if (
  JSON.stringify(Object.keys(manifest.identity.recipeHashes).sort()) !==
    JSON.stringify([...BUILD_INPUT_FILES].sort()) ||
  JSON.stringify(Object.keys(manifest.identity.inputHashes).sort()) !==
    JSON.stringify([...sourceFiles].sort())
)
  throw Error('Unexpected native corresponding-source file set');
if (
  JSON.stringify(manifest.identity.sources) !== JSON.stringify(UPSTREAM) ||
  JSON.stringify(manifest.identity.nodeLicense) !== JSON.stringify(NODE_LICENSE)
)
  throw Error('Native upstream identity mismatch');
for (const [base, hashes] of [
  [project, manifest.identity.recipeHashes],
  [join(project, 'native/macos/playback'), manifest.identity.inputHashes],
]) {
  if (
    JSON.stringify(await hashFiles(base, Object.keys(hashes))) !==
    JSON.stringify(hashes)
  )
    throw Error('Native source changed since build');
}
const root = await mkdtemp(join(cache, 'sources-'));
try {
  const copy = async (source, destination) => {
    const out = join(root, destination);
    await mkdir(dirname(out), { recursive: true });
    await copyFile(source, out);
  };
  for (const source of Object.values(UPSTREAM)) {
    const file = join(cache, 'source', basename(source.url));
    if ((await hashFile(file)) !== source.sha256)
      throw Error('Native upstream archive hash');
    await copy(file, `upstream/${basename(source.url)}`);
    if (
      (await hashFile(join(root, 'upstream', basename(source.url)))) !==
      source.sha256
    )
      throw Error('Native upstream snapshot changed');
  }
  const license = join(cache, 'source/node-v22.12.0-LICENSE');
  if ((await hashFile(license)) !== NODE_LICENSE.sha256)
    throw Error('Node notice hash');
  await copy(license, 'upstream/node-v22.12.0-LICENSE');
  if (
    (await hashFile(join(root, 'upstream/node-v22.12.0-LICENSE'))) !==
    NODE_LICENSE.sha256
  )
    throw Error('Node notice snapshot changed');
  for (const file of Object.keys(manifest.identity.recipeHashes))
    await copy(join(project, file), file);
  for (const file of Object.keys(manifest.identity.inputHashes))
    await copy(
      join(project, 'native/macos/playback', file),
      `native/macos/playback/${file}`,
    );
  for (const [base, hashes] of [
    [root, manifest.identity.recipeHashes],
    [join(root, 'native/macos/playback'), manifest.identity.inputHashes],
  ]) {
    if (
      JSON.stringify(await hashFiles(base, Object.keys(hashes))) !==
      JSON.stringify(hashes)
    )
      throw Error('Native archive snapshot changed');
  }
  await mkdir(join(root, 'manifests'));
  await writeFile(join(root, 'manifests/darwin-arm64.json'), manifestBytes);
  await writeFile(
    join(root, 'README.md'),
    `# Native playback corresponding source\n\nThis archive matches the unsigned helper/receiver and source hashes in manifests/darwin-arm64.json. No video, user project, model or private diagnostic log is included.\n\nRebuild on macOS arm64 with Node.js >=22.12.0, Xcode command line tools (clang++, SDK, make, tar) and curl. No npm install or Electron app is required. The recorded compiler and SDK identify the original build; a different toolchain may produce different bytes.\n\n1. Copy the three upstream files into .cache/native-playback/source/ (preserving their names).\n2. Run: node scripts/build-native-playback.mjs\n3. Inspect .cache/native-playback/darwin-arm64/build.json and its two binaries.\n\nThe complete MIT helper and receiver sources are under native/macos/playback. The build reapplies the local filter/frame-decoder QoS adaptation in scripts/native-playback/worker-thread-qos.mjs and WorkerThreadQoS.h to the verified upstream archive. A modified FFmpeg with different internal thread call sites must update that adaptation explicitly; it fails closed on an unknown layout. The complete upstream FFmpeg archive contains LGPL and other applicable notices. To relink against your modified FFmpeg, create an archive retaining the ffmpeg-8.1.2 directory, put its URL/SHA-256 in scripts/media-tools/sources.mjs, and run the same build recipe. This invalidates the cache and rebuilds the helper with those libraries; no proprietary link objects are required. Do not represent a modified build as the original build.\n\nNode headers and their pinned full LICENSE are separate inputs. Apple system frameworks are not redistributed. See native/macos/playback/NOTICE.md and the upstream license texts for their respective terms.\n`,
  );
  const version = JSON.parse(
    await readFile(join(project, 'package.json'), 'utf8'),
  ).version;
  const identity = manifestHash.slice(0, 16);
  const output = join(
    project,
    'dist',
    `native-playback-sources-${version}-darwin-arm64-${identity}.tar.gz`,
  );
  await mkdir(dirname(output), { recursive: true });
  await run('python3', [
    join(project, 'scripts/media-tools/archive-sources.py'),
    root,
    output,
    'native-playback-sources',
  ]);
  console.log(
    JSON.stringify({
      artifact: basename(output),
      sha256: await hashFile(output),
      nativeManifestSHA256: manifestHash,
    }),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
