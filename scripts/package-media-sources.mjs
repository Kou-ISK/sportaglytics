import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  sourceBundleOptions,
  sourcesForTargets,
} from './media-tools/source-bundle.mjs';
import { validateBuildManifest } from './media-tools/source-manifest.mjs';
import { hashFile } from './download-verified.mjs';
import { downloadSourceArchive } from './media-tools/source-download.mjs';
import { run } from './media-tools/process.mjs';

// Only public, explicitly enumerated inputs. Never archive the workspace/cache wholesale.
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const options = sourceBundleOptions(process.argv.slice(2));
const builds = {};
for (const target of options.targets) {
  const file =
    target === 'win32-x64'
      ? 'dist/media-builds/win32-x64.json'
      : `.cache/media-tools/${target}/build.json`;
  try {
    builds[target] = validateBuildManifest(
      JSON.parse(await readFile(file, 'utf8')),
      target,
    );
  } catch (error) {
    if (error.code !== 'ENOENT' || options.requireBuilds) throw error;
  }
}
const staging = await mkdtemp(join(tmpdir(), 'sportaglytics-media-sources-'));
try {
  const root = join(staging, 'media-tools-sources');
  await mkdir(join(root, 'upstream'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  const sources = {};
  for (const [name, source] of Object.entries(
    sourcesForTargets(options.targets),
  )) {
    const file = `${source.directory}-${basename(source.url)}`;
    const cache = resolve('.cache/media-tools/source', file);
    await downloadSourceArchive(source, cache);
    await copyFile(cache, join(root, 'upstream', file));
    sources[name] = { ...source, file: `upstream/${file}` };
  }
  await copyFile(
    'scripts/build-media-tools.mjs',
    join(root, 'scripts/build-media-tools.mjs'),
  );
  await copyFile(
    'scripts/download-verified.mjs',
    join(root, 'scripts/download-verified.mjs'),
  );
  await mkdir(join(root, 'scripts/media-tools'), { recursive: true });
  for (const file of [
    'sources.mjs',
    'source-download.mjs',
    'process.mjs',
    'macos.mjs',
    'windows.mjs',
    'toolchain-notices.mjs',
  ]) {
    await copyFile(
      `scripts/media-tools/${file}`,
      join(root, 'scripts/media-tools', file),
    );
  }
  await copyFile('LICENSE', join(root, 'LICENSE'));
  await copyFile('docs/third-party-distribution.md', join(root, 'README.md'));
  await writeFile(
    join(root, 'manifest.json'),
    JSON.stringify(
      { version, targets: options.targets, sources, builds },
      null,
      2,
    ) + '\n',
  );
  await mkdir('dist', { recursive: true });
  const suffix = options.platform === 'all' ? '' : `-${options.platform}`;
  const archive = resolve(
    'dist',
    `media-tools-sources-${version}${suffix}.tar.gz`,
  );
  await run(process.platform === 'win32' ? 'python' : 'python3', [
    fileURLToPath(new URL('./media-tools/archive-sources.py', import.meta.url)),
    root,
    archive,
  ]);
  console.log(
    `${basename(archive)} SHA-256 ${await hashFile(archive)} (${Object.keys(builds).length}/${options.targets.length} build manifests)`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
