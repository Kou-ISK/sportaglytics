import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { extractFile, listPackage } from '@electron/asar';
import { verifyWindowsToolchainNotices } from '../media-tools/toolchain-notices.mjs';
import { validateBuildManifest } from '../media-tools/source-manifest.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireMatch = (condition, label) => {
  if (!condition) throw new Error(`Distribution mismatch: ${label}`);
};
const relative = (name) => {
  requireMatch(
    typeof name === 'string' &&
      !/[\\:\x00-\x1f]/.test(name) &&
      name.split('/').every((part) => part && part !== '.' && part !== '..'),
    'relative path',
  );
  return name;
};
const filesUnder = async (root, prefix = '') => {
  const files = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const name = relative(prefix ? `${prefix}/${entry.name}` : entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(root, name)));
    else {
      requireMatch(entry.isFile(), 'regular resource files');
      files.push(name);
    }
  }
  return files.sort();
};

/** Inspect installed bytes, without launching code from the archive or fetching URLs. */
export const verifyInstalledDistribution = async ({
  project,
  installation,
  installer,
  signatures,
}) => {
  const resources = join(installation, 'resources');
  const archive = join(resources, 'app.asar');
  // ASAR's filesystem walker splits paths using the host's native separator.
  const readArchive = (name) =>
    extractFile(archive, join(...relative(name).split('/')));
  const archiveFiles = listPackage(archive).map((name) =>
    name.replace(/^[/\\]/, '').replaceAll('\\', '/'),
  );
  const resourceFiles = await filesUnder(resources);
  requireMatch(
    ![...archiveFiles, ...resourceFiles].some((name) => /\.gguf$/i.test(name)),
    'GGUF weights must not ship',
  );
  requireMatch(
    ![...resourceFiles, ...archiveFiles].some((name) =>
      /(^|\/)event-detection-models\/[^/]/i.test(name),
    ),
    'default candidate must not contain an event pack',
  );
  const files = [];
  const compare = (name, actual, expected) => {
    requireMatch(actual.equals(expected), name);
    files.push({ path: name, bytes: actual.length, sha256: digest(actual) });
  };
  const compareResource = async (name, source) =>
    compare(
      `resources/${name}`,
      await readFile(join(resources, name)),
      await readFile(join(project, source)),
    );
  const compareArchive = async (name, source) =>
    compare(
      `app.asar/${name}`,
      readArchive(name),
      await readFile(join(project, source)),
    );
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md'])
    await compareResource(name, name);
  for (const [name, source] of [
    ['licenses/renderer.json', 'build/licenses/renderer.json'],
    ['licenses/preload.json', 'build/electron/src/licenses/preload.json'],
  ]) {
    const inventory = JSON.parse(await readFile(join(project, source), 'utf8'));
    requireMatch(
      Array.isArray(inventory) &&
        (name.includes('preload') || inventory.length > 0),
      'license inventory',
    );
    await compareResource(name, source);
    await compareArchive(source, source);
  }
  const version = JSON.parse(
    await readFile(join(project, 'package.json'), 'utf8'),
  ).version;
  requireMatch(
    JSON.parse(readArchive('package.json')).version === version,
    'application version',
  );
  const assetInventoryBytes = await readFile(
    join(project, 'docs/asset-inventory.json'),
  );
  const assets = JSON.parse(assetInventoryBytes).files;
  requireMatch(Array.isArray(assets) && assets.length > 0, 'asset inventory');
  let packagedAssets = 0;
  for (const entry of assets) {
    const source = relative(entry.path);
    const bytes = await readFile(join(project, source));
    requireMatch(
      bytes.length === entry.bytes && digest(bytes) === entry.sha256,
      `asset inventory: ${source}`,
    );
    if (source.startsWith('public/')) {
      compare(
        `app.asar/build/${source.slice(7)}`,
        readArchive(`build/${source.slice(7)}`),
        bytes,
      );
      packagedAssets += 1;
    }
  }
  const modelNotice = await readFile(
    join(project, 'resources/pitch-vision/NOTICE.md'),
    'utf8',
  );
  const modelHash = modelNotice.match(/^SHA-256: ([a-f0-9]{64})\r?$/m)?.[1];
  const model = readArchive('build/pitch-vision/efficientdet-lite2.tflite');
  requireMatch(modelHash && digest(model) === modelHash, 'pinned Paint model');
  await compareArchive(
    'build/pitch-vision/efficientdet-lite2.tflite',
    'public/pitch-vision/efficientdet-lite2.tflite',
  );
  for (const name of await filesUnder(
    join(project, 'resources/pitch-vision'),
  )) {
    await compareArchive(
      `build/pitch-vision/licenses/${name}`,
      `resources/pitch-vision/${name}`,
    );
  }
  const wasmFiles = await filesUnder(
    join(project, 'node_modules/@mediapipe/tasks-vision/wasm'),
  );
  requireMatch(wasmFiles.length > 0, 'WASM distribution is empty');
  for (const name of wasmFiles) {
    await compareArchive(
      `build/pitch-vision/wasm/${name}`,
      `node_modules/@mediapipe/tasks-vision/wasm/${name}`,
    );
  }
  const mediaBuild = validateBuildManifest(
    JSON.parse(
      await readFile(join(resources, 'media-tools/build.json'), 'utf8'),
    ),
    'win32-x64',
  );
  const toolchain = await verifyWindowsToolchainNotices(
    join(resources, 'media-tools'),
  );
  for (const name of await filesUnder(
    join(project, '.cache/media-tools/win32-x64/licenses'),
  )) {
    await compareResource(
      `media-tools/licenses/${name}`,
      `.cache/media-tools/win32-x64/licenses/${name}`,
    );
  }
  await compareResource(
    'media-tools/build.json',
    '.cache/media-tools/win32-x64/build.json',
  );
  const binaries = [];
  const targets = [
    ['installer', installer],
    ['application', join(installation, 'SporTagLytics.exe')],
    ['ffmpeg', join(resources, 'media-tools/ffmpeg.exe')],
    ['ffprobe', join(resources, 'media-tools/ffprobe.exe')],
  ];
  requireMatch(
    Array.isArray(signatures) && signatures.length === targets.length,
    'signature report coverage',
  );
  for (const [role, path] of targets) {
    requireMatch((await lstat(path)).isFile(), `binary: ${role}`);
    const bytes = await readFile(path);
    const sha256 = digest(bytes);
    const matches = signatures.filter((entry) => entry.role === role);
    requireMatch(matches.length === 1, `signature report: ${role}`);
    const signature = matches[0];
    requireMatch(
      signature.sha256 === sha256 &&
        ['Valid', 'NotSigned'].includes(signature.status),
      `signature status/hash: ${role}`,
    );
    const buildSha256 = mediaBuild.binaries[role];
    // Authenticode changes native file bytes. Preserve the pre-signing manifest hash separately.
    if (buildSha256 && signature.status === 'NotSigned')
      requireMatch(sha256 === buildSha256, `unsigned binary hash: ${role}`);
    binaries.push({
      role,
      bytes: bytes.length,
      sha256,
      signatureStatus: signature.status,
      ...(buildSha256
        ? {
            preSigningBuildSha256: buildSha256,
            matchesBuildBytes: sha256 === buildSha256,
          }
        : {}),
    });
  }
  return {
    schemaVersion: 1,
    version,
    comparison: 'installed bytes against this checkout and its build outputs',
    files,
    assetInventory: {
      sha256: digest(assetInventoryBytes),
      sourceFiles: assets.length,
      packagedFiles: packagedAssets,
    },
    models: { pitchModelSha256: modelHash, ggufFiles: 0, eventPackFiles: 0 },
    toolchain: {
      compilerVersion: toolchain.compilerVersion,
      noticeFiles: Object.keys(toolchain.files).length,
    },
    binaries,
  };
};
