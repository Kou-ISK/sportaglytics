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
import { arch as hostArch, cpus, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const SOURCES = {
  ffmpeg: {
    version: '8.1.2',
    url: 'https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz',
    sha256: '464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c',
    directory: 'ffmpeg-8.1.2',
  },
  freetype: {
    version: '2.14.3',
    url: 'https://download-mirror.savannah.gnu.org/releases/freetype/freetype-2.14.3.tar.xz',
    sha256: '36bc4f1cc413335368ee656c42afca65c5a3987e8768cc28cf11ba775e785a5f',
    directory: 'freetype-2.14.3',
  },
  harfbuzz: {
    version: '14.3.0',
    url: 'https://github.com/harfbuzz/harfbuzz/releases/download/14.3.0/harfbuzz-14.3.0.tar.xz',
    sha256: '16070d77cfc4ba1f1e7327e83bf9b3f55898081cabdb94e56a33e04fc8874eae',
    directory: 'harfbuzz-14.3.0',
  },
};
const BUILD_REVISION = 2;
const outputRoot = resolve('.cache/media-tools');
const parallelism = String(Math.max(2, cpus().length));

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(`${command} failed with exit code ${code ?? 'unknown'}`),
        );
    });
  });

const sha256 = async (filePath) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

const normalizeArch = (value) => {
  if (value === 'arm64') return 'arm64';
  if (value === 'x64' || value === 'x86_64') return 'x64';
  throw new Error(`Unsupported architecture: ${value}`);
};

const fetchAndExtract = async (source, temporaryDirectory) => {
  const archivePath = join(outputRoot, 'source', basename(source.url));
  await mkdir(dirname(archivePath), { recursive: true });
  if (!existsSync(archivePath)) {
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
      archivePath,
      source.url,
    ]);
  }
  const actualHash = await sha256(archivePath);
  if (actualHash !== source.sha256) {
    await rm(archivePath, { force: true });
    throw new Error(
      `${source.directory} source checksum mismatch: ${actualHash}`,
    );
  }
  await run('tar', ['-xf', archivePath, '-C', temporaryDirectory]);
  return join(temporaryDirectory, source.directory);
};

const buildDependencies = async (sources, architecture, clangArch) => {
  const prefix = join(sources.root, `dependencies-${architecture}`);
  const environment = {
    ...process.env,
    CFLAGS: `-arch ${clangArch} -mmacosx-version-min=13.0`,
    CXXFLAGS: `-arch ${clangArch} -mmacosx-version-min=13.0`,
    LDFLAGS: `-arch ${clangArch} -mmacosx-version-min=13.0`,
    PKG_CONFIG_PATH: join(prefix, 'lib', 'pkgconfig'),
  };

  const freetypeBuild = join(sources.freetype, `build-${architecture}`);
  await mkdir(freetypeBuild, { recursive: true });
  await run(
    join(sources.freetype, 'configure'),
    [
      `--prefix=${prefix}`,
      '--disable-shared',
      '--enable-static',
      '--without-brotli',
      '--without-bzip2',
      '--without-harfbuzz',
      '--without-png',
    ],
    { cwd: freetypeBuild, env: environment },
  );
  await run('make', ['-j', parallelism, 'install'], {
    cwd: freetypeBuild,
    env: environment,
  });

  const harfbuzzBuild = join(sources.harfbuzz, `build-${architecture}`);
  await run(
    'cmake',
    [
      '-S',
      sources.harfbuzz,
      '-B',
      harfbuzzBuild,
      `-DCMAKE_INSTALL_PREFIX=${prefix}`,
      `-DCMAKE_PREFIX_PATH=${prefix}`,
      `-DCMAKE_OSX_ARCHITECTURES=${clangArch}`,
      '-DCMAKE_OSX_DEPLOYMENT_TARGET=13.0',
      '-DBUILD_SHARED_LIBS=OFF',
      '-DHB_HAVE_FREETYPE=ON',
      '-DHB_BUILD_UTILS=OFF',
      '-DHB_BUILD_SUBSET=OFF',
      '-DHB_BUILD_RASTER=OFF',
      '-DHB_BUILD_VECTOR=OFF',
      '-DHB_BUILD_GPU=OFF',
    ],
    { env: environment },
  );
  await run('cmake', ['--build', harfbuzzBuild, '--parallel', parallelism], {
    env: environment,
  });
  await run('cmake', ['--install', harfbuzzBuild], { env: environment });
  return { prefix, environment };
};

const buildArchitecture = async (sources, architecture) => {
  const outputDirectory = join(outputRoot, `darwin-${architecture}`);
  const ffmpegOutput = join(outputDirectory, 'ffmpeg');
  const ffprobeOutput = join(outputDirectory, 'ffprobe');
  const manifestPath = join(outputDirectory, 'build.json');
  const expectedManifest = JSON.stringify({
    revision: BUILD_REVISION,
    architecture,
    sources: Object.fromEntries(
      Object.entries(SOURCES).map(([name, source]) => [name, source.version]),
    ),
  });
  const existingManifest = existsSync(manifestPath)
    ? await readFile(manifestPath, 'utf8')
    : '';
  if (
    existingManifest === expectedManifest &&
    existsSync(ffmpegOutput) &&
    existsSync(ffprobeOutput)
  ) {
    console.log(`Verified media tools already exist for ${architecture}.`);
    return;
  }

  const clangArch = architecture === 'arm64' ? 'arm64' : 'x86_64';
  const dependencies = await buildDependencies(
    sources,
    architecture,
    clangArch,
  );
  const buildDirectory = join(sources.ffmpeg, `build-${architecture}`);
  await mkdir(buildDirectory, { recursive: true });
  const configureArgs = [
    '--target-os=darwin',
    `--arch=${architecture === 'arm64' ? 'aarch64' : 'x86_64'}`,
    '--cc=clang',
    '--disable-autodetect',
    '--disable-doc',
    '--disable-debug',
    '--disable-ffplay',
    '--disable-network',
    '--disable-shared',
    '--enable-static',
    '--enable-audiotoolbox',
    '--enable-bzlib',
    '--enable-libfreetype',
    '--enable-libharfbuzz',
    '--enable-securetransport',
    '--enable-videotoolbox',
    '--enable-zlib',
    '--pkg-config-flags=--static',
    '--extra-libs=-lc++',
    `--extra-cflags=-I${dependencies.prefix}/include -arch ${clangArch} -mmacosx-version-min=13.0`,
    `--extra-ldflags=-L${dependencies.prefix}/lib -arch ${clangArch} -mmacosx-version-min=13.0`,
  ];
  if (architecture === 'x64' && normalizeArch(hostArch()) !== 'x64') {
    configureArgs.push('--enable-cross-compile', '--disable-x86asm');
  }
  await run(join(sources.ffmpeg, 'configure'), configureArgs, {
    cwd: buildDirectory,
    env: dependencies.environment,
  });
  await run('make', ['-j', parallelism, 'ffmpeg', 'ffprobe'], {
    cwd: buildDirectory,
    env: dependencies.environment,
  });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    copyFile(join(buildDirectory, 'ffmpeg'), ffmpegOutput),
    copyFile(join(buildDirectory, 'ffprobe'), ffprobeOutput),
  ]);
  const licensesDirectory = join(outputDirectory, 'licenses');
  await mkdir(licensesDirectory, { recursive: true });
  await Promise.all([
    copyFile(
      join(sources.ffmpeg, 'COPYING.LGPLv2.1'),
      join(licensesDirectory, 'FFmpeg-COPYING.LGPLv2.1'),
    ),
    copyFile(
      join(sources.freetype, 'LICENSE.TXT'),
      join(licensesDirectory, 'FreeType-LICENSE.TXT'),
    ),
    copyFile(
      join(sources.harfbuzz, 'COPYING'),
      join(licensesDirectory, 'HarfBuzz-COPYING'),
    ),
  ]);
  await Promise.all([chmod(ffmpegOutput, 0o755), chmod(ffprobeOutput, 0o755)]);
  await run(ffmpegOutput, ['-version']);
  await run(ffprobeOutput, ['-version']);
  await writeFile(manifestPath, expectedManifest, 'utf8');
};

const requested = process.argv.slice(2);
const architectures = requested.includes('--all-mac')
  ? ['x64', 'arm64']
  : [normalizeArch(hostArch())];
if (process.platform !== 'darwin') {
  throw new Error(
    'The reproducible media tool build currently supports macOS only.',
  );
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'sportaglytics-media-'),
);
try {
  const [ffmpeg, freetype, harfbuzz] = await Promise.all([
    fetchAndExtract(SOURCES.ffmpeg, temporaryDirectory),
    fetchAndExtract(SOURCES.freetype, temporaryDirectory),
    fetchAndExtract(SOURCES.harfbuzz, temporaryDirectory),
  ]);
  const sources = { root: temporaryDirectory, ffmpeg, freetype, harfbuzz };
  for (const architecture of architectures) {
    await buildArchitecture(sources, architecture);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
