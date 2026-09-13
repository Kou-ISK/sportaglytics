import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { SOURCES } from './media-tools/sources.mjs';
import { run } from './media-tools/process.mjs';
import { buildMacMediaTools } from './media-tools/macos.mjs';
import { buildWindowsMediaTools } from './media-tools/windows.mjs';

const BUILD_REVISION = 3;
const outputRoot = resolve('.cache/media-tools');
const platform = process.platform;
const parallelism = String(Math.max(2, Math.min(12, cpus().length)));
if (platform !== 'darwin' && platform !== 'win32') {
  throw new Error('Verified media builds support macOS and Windows.');
}
const architectures =
  process.argv.includes('--all-mac') && platform === 'darwin'
    ? ['x64', 'arm64']
    : [process.arch];
if (
  architectures.some((arch) => !['x64', 'arm64'].includes(arch)) ||
  (platform === 'win32' && process.arch !== 'x64')
) {
  throw new Error(`Unsupported media target: ${platform}-${process.arch}`);
}
const selectedSources = Object.fromEntries(
  Object.entries(SOURCES).filter(
    ([name]) => name !== 'openh264' || platform === 'win32',
  ),
);
const hashFile = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const executableName = (name) => (platform === 'win32' ? `${name}.exe` : name);
const buildIdentity = (architecture) => ({
  revision: platform === 'win32' ? BUILD_REVISION + 1 : BUILD_REVISION,
  platform,
  architecture,
  sources: Object.fromEntries(
    Object.entries(selectedSources).map(([name, source]) => [
      name,
      { version: source.version, sha256: source.sha256 },
    ]),
  ),
});
const isCached = async (architecture) => {
  const output = join(outputRoot, `${platform}-${architecture}`);
  try {
    const manifest = JSON.parse(
      await readFile(join(output, 'build.json'), 'utf8'),
    );
    if (
      JSON.stringify(manifest.identity) !==
      JSON.stringify(buildIdentity(architecture))
    )
      return false;
    for (const tool of ['ffmpeg', 'ffprobe']) {
      if (
        (await hashFile(join(output, executableName(tool)))) !==
        manifest.binaries?.[tool]
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
};
const fetchAndExtract = async (source, temporaryDirectory) => {
  const archive = join(
    outputRoot,
    'source',
    `${source.directory}-${basename(source.url)}`,
  );
  await mkdir(dirname(archive), { recursive: true });
  if (!existsSync(archive)) {
    await run('curl', [
      '--fail',
      '--location',
      '--retry',
      '3',
      '--connect-timeout',
      '15',
      '--max-time',
      '600',
      '--output',
      archive,
      source.url,
    ]);
  }
  if ((await hashFile(archive)) !== source.sha256) {
    await rm(archive, { force: true });
    throw new Error(`${source.directory} source checksum mismatch`);
  }
  await run('tar', [
    ...(platform === 'win32' ? ['--force-local'] : []),
    '-xf',
    archive.replaceAll('\\', '/'),
    '-C',
    temporaryDirectory.replaceAll('\\', '/'),
  ]);
  return join(temporaryDirectory, source.directory);
};
const pending = [];
for (const architecture of architectures) {
  if (await isCached(architecture))
    console.log(`Verified cached media tools: ${platform}-${architecture}`);
  else pending.push(architecture);
}
if (pending.length > 0) {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'sportaglytics-media-'),
  );
  try {
    const sources = { root: temporaryDirectory };
    for (const [name, source] of Object.entries(selectedSources)) {
      sources[name] = await fetchAndExtract(source, temporaryDirectory);
    }
    for (const architecture of pending) {
      const outputDirectory = join(outputRoot, `${platform}-${architecture}`);
      const builder =
        platform === 'win32' ? buildWindowsMediaTools : buildMacMediaTools;
      await builder({ sources, architecture, outputDirectory, parallelism });
      const licenses = join(outputDirectory, 'licenses');
      await mkdir(licenses, { recursive: true });
      for (const [name, file] of [
        ['ffmpeg', 'COPYING.LGPLv2.1'],
        ['freetype', 'LICENSE.TXT'],
        ['harfbuzz', 'COPYING'],
        ...(platform === 'win32' ? [['openh264', 'LICENSE']] : []),
      ]) {
        await copyFile(
          join(sources[name], file),
          join(licenses, `${name}-${file}`),
        );
      }
      const binaries = {};
      for (const tool of ['ffmpeg', 'ffprobe']) {
        const executable = join(outputDirectory, executableName(tool));
        await chmod(executable, 0o755);
        await run(executable, ['-version']);
        binaries[tool] = await hashFile(executable);
      }
      await writeFile(
        join(outputDirectory, 'build.json'),
        JSON.stringify(
          {
            identity: buildIdentity(architecture),
            binaries,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
