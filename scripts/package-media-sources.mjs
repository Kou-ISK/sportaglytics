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
import { SOURCES } from './media-tools/sources.mjs';
import { validateBuildManifest } from './media-tools/source-manifest.mjs';
import { hashFile } from './download-verified.mjs';
import { downloadSourceArchive } from './media-tools/source-download.mjs';
import { run } from './media-tools/process.mjs';

// Only public, explicitly enumerated inputs. Never archive the workspace/cache wholesale.
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const staging = await mkdtemp(join(tmpdir(), 'sportaglytics-media-sources-'));
try {
  const root = join(staging, 'media-tools-sources');
  await mkdir(join(root, 'upstream'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  const sources = {};
  for (const [name, source] of Object.entries(SOURCES)) {
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
  ]) {
    await copyFile(
      `scripts/media-tools/${file}`,
      join(root, 'scripts/media-tools', file),
    );
  }
  await copyFile('LICENSE', join(root, 'LICENSE'));
  await copyFile('docs/third-party-distribution.md', join(root, 'README.md'));
  const builds = {};
  for (const target of ['darwin-x64', 'darwin-arm64', 'win32-x64']) {
    const file =
      target === 'win32-x64'
        ? 'dist/media-builds/win32-x64.json'
        : `.cache/media-tools/${target}/build.json`;
    try {
      const manifest = JSON.parse(await readFile(file, 'utf8'));
      builds[target] = validateBuildManifest(manifest, target);
    } catch (error) {
      if (error.code !== 'ENOENT' || process.argv.includes('--require-builds'))
        throw error;
    }
  }
  await writeFile(
    join(root, 'manifest.json'),
    JSON.stringify({ version, sources, builds }, null, 2) + '\n',
  );
  await mkdir('dist', { recursive: true });
  const archive = resolve('dist', `media-tools-sources-${version}.tar.gz`);
  await run('tar', ['-czf', archive, '-C', staging, 'media-tools-sources']);
  console.log(
    `${basename(archive)} SHA-256 ${await hashFile(archive)} (${Object.keys(builds).length}/3 build manifests)`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
