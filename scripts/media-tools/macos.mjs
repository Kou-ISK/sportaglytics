import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { arch as hostArch } from 'node:os';
import { run } from './process.mjs';

const buildDependencies = async (
  sources,
  architecture,
  clangArch,
  parallelism,
) => {
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

export const buildMacMediaTools = async ({
  sources,
  architecture,
  outputDirectory,
  parallelism,
}) => {
  const ffmpegOutput = join(outputDirectory, 'ffmpeg');
  const ffprobeOutput = join(outputDirectory, 'ffprobe');
  const clangArch = architecture === 'arm64' ? 'arm64' : 'x86_64';
  const dependencies = await buildDependencies(
    sources,
    architecture,
    clangArch,
    parallelism,
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
  if (architecture === 'x64' && hostArch() !== 'x64') {
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
};
