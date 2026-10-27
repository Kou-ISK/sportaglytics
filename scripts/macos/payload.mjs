import {
  signatureVerifier,
  verifyNativeResourceSet,
} from './native-signing.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import * as asar from '@electron/asar';
import { basename, join } from 'node:path';
import { SOURCES } from '../media-tools/sources.mjs';
import { validateBuildManifest } from '../media-tools/source-manifest.mjs';
import {
  verifyMacLlamaNotices,
  MAC_LLAMA_VERSION,
} from '../mac-llama-notices.mjs';
import {
  PAYLOAD_FILES,
  verifyNativeBuild,
  hashFiles,
} from '../native-playback/manifest.mjs';
import {
  BUILD_INPUT_FILES,
  BUILD_REVISION,
} from '../native-playback/recipe.mjs';

export async function verifyMacPayload({ project, app, arch, signed = false }) {
  if (!['arm64', 'x64'].includes(arch)) throw Error('Invalid target');
  const resources = join(app, 'Contents/Resources');
  const archive = join(resources, 'app.asar');
  const readArchive = (name) =>
    asar.extractFile(archive, join(...name.split('/')));
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  const checks = [];
  const native = [];
  const equal = (kind, path, actual, expected) => {
    if (!actual.equals(expected)) throw Error(`${kind} byte mismatch: ${path}`);
    checks.push({ kind, path, bytes: actual.length, sha256: hash(actual) });
  };
  const compareResource = async (path, source) =>
    equal(
      'resource-source',
      path,
      await readFile(join(resources, path)),
      await readFile(join(project, source)),
    );
  const filesUnder = async (root, prefix = '') => {
    const result = [];
    for (const entry of await readdir(join(root, prefix), {
      withFileTypes: true,
    })) {
      const name = join(prefix, entry.name);
      if (entry.isDirectory()) result.push(...(await filesUnder(root, name)));
      else if (entry.isFile()) result.push(name);
      else throw Error(`Unexpected nonregular source/resource: ${name}`);
    }
    return result.sort();
  };
  const entries = [];
  for (const listed of asar.listPackage(archive)) {
    const path = listed.replace(/^[/\\]/, '').replaceAll('\\', '/');
    if (
      path.split('/').some((x) => !x || x === '.' || x === '..') ||
      path.includes('\\')
    )
      throw Error(`Unsafe ASAR name: ${path}`);
    const info = asar.statFile(archive, join(...path.split('/')), false);
    if (info.files) {
      entries.push({ path, type: 'directory' });
      continue;
    }
    if (info.link) throw Error(`Unexpected ASAR link: ${path}`);
    const bytes = readArchive(path);
    if (bytes.length !== info.size) throw Error(`ASAR size: ${path}`);
    const record = {
      path,
      type: 'file',
      bytes: bytes.length,
      sha256: hash(bytes),
      unpacked: !!info.unpacked,
    };
    if (path === 'package.json') {
      const packed = JSON.parse(bytes);
      const source = JSON.parse(await readFile(join(project, path), 'utf8'));
      for (const key of ['name', 'version', 'main', 'description', 'license'])
        if (packed[key] !== source[key])
          throw Error(`Package metadata: ${key}`);
      record.sourceComparison =
        'generated package.json; identity/version/main/description/license match source';
      record.packagedMetadata = packed;
    } else {
      if (!path.startsWith('build/'))
        throw Error(`Unexpected archived root: ${path}`);
      equal(
        'full-asar-build-source',
        path,
        bytes,
        await readFile(join(project, path)),
      );
      record.sourceComparison = 'byte-identical to current checkout build';
    }
    entries.push(record);
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));

  const resourceFiles = await filesUnder(resources);
  const nativeResources = resourceFiles.filter((name) =>
    name.startsWith('native-playback/'),
  );
  verifyNativeResourceSet(nativeResources, arch);
  if (nativeResources.length) {
    if (arch !== 'arm64') throw Error('Native playback requires macOS arm64');
    if (
      JSON.stringify(nativeResources.sort()) !==
      JSON.stringify(PAYLOAD_FILES.map((file) => `native-playback/${file}`))
    )
      throw Error('Native preview exact resource set mismatch');
    const generated = join(project, '.cache/native-playback/darwin-arm64');
    const manifest = JSON.parse(
      await readFile(join(generated, 'build.json'), 'utf8'),
    );
    if (manifest.identity.revision !== BUILD_REVISION)
      throw Error('Native preview build revision mismatch');
    await verifyNativeBuild(generated, manifest.identity);
    const inputs = JSON.parse(
      await readFile(
        join(project, 'native/macos/playback/source-files.json'),
        'utf8',
      ),
    );
    if (
      JSON.stringify(
        await hashFiles(join(project, 'native/macos/playback'), inputs),
      ) !== JSON.stringify(manifest.identity.inputHashes) ||
      JSON.stringify(await hashFiles(project, BUILD_INPUT_FILES)) !==
        JSON.stringify(manifest.identity.recipeHashes)
    )
      throw Error('Native preview build no longer matches checkout');
    const packaged = JSON.parse(
      await readFile(join(resources, 'native-playback/build.json'), 'utf8'),
    );
    const { signing, ...original } = packaged;
    if (JSON.stringify(original) !== JSON.stringify(manifest))
      throw Error('Native unsigned manifest changed');
    let authenticated = null;
    if (signed) {
      const verifier = signatureVerifier(project);
      authenticated = verifier.parseNativeSigning(signing);
      await verifier.verifySignedNative(resources, authenticated);
    } else if (signing !== undefined)
      throw Error('Unexpected signed native manifest before signing');
    // The immutable unsigned manifest remains the comparison record on both sides.
    equal(
      'resource-source',
      'native-playback/build.json',
      Buffer.from(JSON.stringify(original)),
      Buffer.from(JSON.stringify(manifest)),
    );
    for (const file of PAYLOAD_FILES.filter((name) => name !== 'build.json')) {
      const binary = file === 'NativeProductHost' || file === 'Receiver.node';
      if (!signed || !binary)
        await compareResource(
          `native-playback/${file}`,
          `.cache/native-playback/darwin-arm64/${file}`,
        );
      if (binary) {
        const actualHash = hash(
          await readFile(join(resources, 'native-playback', file)),
        );
        if (authenticated && actualHash !== authenticated.files[file].sha256)
          throw Error('Signed native resource hash mismatch');
        native.push({
          path: `native-playback/${file}`,
          sha256: actualHash,
          preSigningSha256: manifest.files[file],
        });
      }
    }
  }
  const nativeAllowed = new Set(nativeResources);
  const allowedResource = (name) =>
    [
      'app.asar',
      'icon.icns',
      'LICENSE.electron.txt',
      'LICENSES.chromium.html',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'stpkg.icns',
      'stpl.icns',
      'stcw.icns',
      'stad.icns',
    ].includes(name) ||
    nativeAllowed.has(name) ||
    /^(?:licenses|media-tools|llama|[^/]+\.lproj)\//.test(name);
  if (resourceFiles.some((name) => !allowedResource(name)))
    throw Error('Unexpected packaged resource');
  const prohibited = [...entries.map((x) => x.path), ...resourceFiles].filter(
    (name) =>
      /\.gguf$/i.test(name) || /(^|\/)event-detection-models\/[^/]/i.test(name),
  );
  if (prohibited.length)
    throw Error(
      `Private/default-excluded models found: ${prohibited.join(',')}`,
    );
  const expectedModelPaths = [
    'build/pitch-vision/efficientdet-lite2.tflite',
    'build/electron/src/pitch-vision/efficientdet-lite2.tflite',
  ];
  const modelPaths = [
    ...entries.filter((x) => x.type === 'file').map((x) => x.path),
    ...resourceFiles,
  ].filter((name) =>
    /\.(?:gguf|onnx|safetensors|tflite|pt|pth|ckpt|weights)$/i.test(name),
  );
  if (
    JSON.stringify(modelPaths.sort()) !==
    JSON.stringify(expectedModelPaths.sort())
  )
    throw Error('Unexpected weight files');

  for (const path of ['LICENSE', 'THIRD_PARTY_NOTICES.md'])
    await compareResource(path, path);
  const inventoryCounts = {};
  for (const [name, source] of [
    ['renderer', 'build/licenses/renderer.json'],
    ['preload', 'build/electron/src/licenses/preload.json'],
  ]) {
    await compareResource(`licenses/${name}.json`, source);
    const inventory = JSON.parse(await readFile(join(project, source), 'utf8'));
    if (!Array.isArray(inventory) || (name === 'renderer' && !inventory.length))
      throw Error('Invalid JS license inventory');
    inventoryCounts[name] = inventory.length;
  }
  const assets = JSON.parse(
    await readFile(join(project, 'docs/asset-inventory.json'), 'utf8'),
  ).files;
  let packagedAssetCount = 0;
  for (const item of assets) {
    const bytes = await readFile(join(project, item.path));
    if (bytes.length !== item.bytes || hash(bytes) !== item.sha256)
      throw Error(`Source asset inventory mismatch: ${item.path}`);
    checks.push({
      kind: 'tracked-asset-inventory',
      path: item.path,
      bytes: bytes.length,
      sha256: hash(bytes),
    });
    if (item.path.startsWith('public/')) {
      const path = `build/${item.path.slice(7)}`;
      equal('packaged-public-asset', path, readArchive(path), bytes);
      packagedAssetCount++;
    }
  }
  const notice = await readFile(
    join(project, 'resources/pitch-vision/NOTICE.md'),
    'utf8',
  );
  const modelHash = notice.match(/^SHA-256: ([a-f0-9]{64})\r?$/m)?.[1];
  if (
    modelHash !==
    'b3f50554cb0ea559e90328845f7d9ba4d13c8bff372914d24e06bc8bb72fa896'
  )
    throw Error('Unexpected pinned model');
  for (const prefix of [
    'build/pitch-vision',
    'build/electron/src/pitch-vision',
  ]) {
    const path = `${prefix}/efficientdet-lite2.tflite`;
    if (hash(readArchive(path)) !== modelHash)
      throw Error(`Model hash: ${path}`);
    for (const name of await filesUnder(
      join(project, 'resources/pitch-vision'),
    ))
      equal(
        'paint-notice',
        `${prefix}/licenses/${name}`,
        readArchive(`${prefix}/licenses/${name}`),
        await readFile(join(project, 'resources/pitch-vision', name)),
      );
    for (const name of await filesUnder(
      join(project, 'node_modules/@mediapipe/tasks-vision/wasm'),
    ))
      equal(
        'paint-wasm',
        `${prefix}/wasm/${name}`,
        readArchive(`${prefix}/wasm/${name}`),
        await readFile(
          join(project, 'node_modules/@mediapipe/tasks-vision/wasm', name),
        ),
      );
  }

  const media = validateBuildManifest(
    JSON.parse(
      await readFile(join(resources, 'media-tools/build.json'), 'utf8'),
    ),
    `darwin-${arch}`,
  );
  await compareResource(
    'media-tools/build.json',
    `.cache/media-tools/darwin-${arch}/build.json`,
  );
  for (const [name, expected] of Object.entries(media.binaries)) {
    const bytes = await readFile(join(resources, 'media-tools', name));
    const sourceBytes = await readFile(
      join(project, `.cache/media-tools/darwin-${arch}/${name}`),
    );
    if (hash(sourceBytes) !== expected)
      throw Error(`Media binary build hash: ${name}`);
    if (!signed)
      equal('unsigned-native', `media-tools/${name}`, bytes, sourceBytes);
    native.push({
      path: `media-tools/${name}`,
      sha256: hash(bytes),
      preSigningSha256: expected,
    });
  }
  for (const [name, file] of [
    ['ffmpeg', 'COPYING.LGPLv2.1'],
    ['freetype', 'LICENSE.TXT'],
    ['freetype', 'docs/FTL.TXT'],
    ['harfbuzz', 'COPYING'],
  ]) {
    const source = SOURCES[name];
    const sourceArchive = join(
      project,
      '.cache/media-tools/source',
      `${source.directory}-${basename(source.url)}`,
    );
    if (hash(await readFile(sourceArchive)) !== source.sha256)
      throw Error(`Pinned source archive: ${name}`);
    const bytes = execFileSync('/usr/bin/tar', [
      '-xOf',
      sourceArchive,
      `${source.directory}/${file}`,
    ]);
    const relative = `media-tools/licenses/${name}-${basename(file)}`;
    equal(
      'pinned-media-source-notice',
      relative,
      await readFile(join(resources, relative)),
      bytes,
    );
  }

  await verifyMacLlamaNotices(
    join(resources, 'llama/darwin'),
    MAC_LLAMA_VERSION,
  );
  await compareResource(
    'llama/darwin/build.json',
    `.cache/llama/darwin-${arch}/build.json`,
  );
  const llama = JSON.parse(
    await readFile(join(resources, 'llama/darwin/build.json'), 'utf8'),
  );
  const expectedLlamaHash =
    arch === 'arm64'
      ? 'b5b8e2f544a2dbfd20a830291843fe3463152fef3999d170f5b00e91b671eb64'
      : 'ab35f38e06e09168754efcc055dbd027d5ead678c7d8ca46486b5903563902d2';
  if (
    llama.identity.archiveHash !== expectedLlamaHash ||
    llama.identity.target !== `darwin-${arch}` ||
    llama.identity.version !== MAC_LLAMA_VERSION
  )
    throw Error('Llama identity');

  for (const [name, expected] of Object.entries(llama.files)) {
    if (
      name.split('/').some((part) => !part || part === '.' || part === '..') ||
      name.includes('\\')
    )
      throw Error('Unsafe llama manifest path');
    const bytes = await readFile(join(resources, 'llama/darwin', name));
    const sourceBytes = await readFile(
      join(project, `.cache/llama/darwin-${arch}/${name}`),
    );
    if (hash(sourceBytes) !== expected)
      throw Error(`Llama manifest file: ${name}`);
    const isNative = bytes.subarray(0, 4).toString('hex') === 'cffaedfe';
    if (!signed || !isNative)
      equal('llama-payload', `llama/darwin/${name}`, bytes, sourceBytes);
    if (isNative)
      native.push({
        path: `llama/darwin/${name}`,
        sha256: hash(bytes),
        preSigningSha256: expected,
      });
  }
  const exactResourceSet = (prefix, expected) => {
    const actual = resourceFiles.filter((name) =>
      name.startsWith(`${prefix}/`),
    );
    const names = expected.map((name) => `${prefix}/${name}`).sort();
    if (JSON.stringify(actual) !== JSON.stringify(names))
      throw Error(`Unexpected or missing resource files: ${prefix}`);
  };
  exactResourceSet('llama', [
    'darwin/build.json',
    ...Object.keys(llama.files).map((name) => `darwin/${name}`),
  ]);
  exactResourceSet('media-tools', [
    'build.json',
    'ffmpeg',
    'ffprobe',
    'licenses/ffmpeg-COPYING.LGPLv2.1',
    'licenses/freetype-LICENSE.TXT',
    'licenses/freetype-FTL.TXT',
    'licenses/harfbuzz-COPYING',
  ]);
  exactResourceSet('licenses', ['preload.json', 'renderer.json']);
  const result = {
    arch,
    passed: true,
    fullAsarInventory: true,
    asarEntries: entries.length,
    asarRegularFiles: entries.filter((x) => x.type === 'file').length,
    fullAsarBuildFileComparisons: checks.filter(
      (x) => x.kind === 'full-asar-build-source',
    ).length,
    generatedPackageMetadataCompared: true,
    assetSourceCount: assets.length,
    packagedAssetCount,
    inventoryCounts,
    modelHash,
    modelPaths,
    prohibitedModelEntries: prohibited.length,
    resourceHashComparisons: checks.length,
    checks,
    native,
    asarSha256: hash(await readFile(archive)),
  };
  return result;
}
