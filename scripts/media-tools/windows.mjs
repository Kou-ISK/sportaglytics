import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './process.mjs';

const slash = (value) => value.replaceAll('\\', '/');

export const buildWindowsMediaTools = async ({
  sources,
  architecture,
  outputDirectory,
  parallelism,
}) => {
  if (architecture !== 'x64' || process.env.MSYSTEM !== 'UCRT64') {
    throw new Error(
      'Windows media tools require the MSYS2 UCRT64 shell and x64 Node.js.',
    );
  }
  const prefix = slash(join(sources.root, 'dependencies-win32-x64'));
  const environment = {
    ...process.env,
    PKG_CONFIG_PATH: `${prefix}/lib/pkgconfig`,
  };
  const cmakeBuild = async (name, flags) => {
    const directory = slash(join(sources[name], 'build-windows'));
    await run(
      'cmake',
      [
        '-S',
        slash(sources[name]),
        '-B',
        directory,
        '-G',
        'Ninja',
        '-DCMAKE_BUILD_TYPE=Release',
        `-DCMAKE_INSTALL_PREFIX=${prefix}`,
        `-DCMAKE_PREFIX_PATH=${prefix}`,
        '-DBUILD_SHARED_LIBS=OFF',
        ...flags,
      ],
      { env: environment },
    );
    await run('cmake', ['--build', directory, '--parallel', parallelism], {
      env: environment,
    });
    await run('cmake', ['--install', directory], { env: environment });
  };
  await cmakeBuild('freetype', [
    '-DFT_DISABLE_ZLIB=ON',
    '-DFT_DISABLE_BZIP2=ON',
    '-DFT_DISABLE_PNG=ON',
    '-DFT_DISABLE_HARFBUZZ=ON',
    '-DFT_DISABLE_BROTLI=ON',
  ]);
  await cmakeBuild('harfbuzz', [
    '-DHB_HAVE_FREETYPE=ON',
    '-DHB_BUILD_UTILS=OFF',
    '-DHB_BUILD_SUBSET=OFF',
    '-DHB_BUILD_RASTER=OFF',
    '-DHB_BUILD_VECTOR=OFF',
    '-DHB_BUILD_GPU=OFF',
  ]);
  await run(
    'make',
    [
      '-j',
      parallelism,
      'install-static',
      'OS=mingw_nt',
      'ARCH=x86_64',
      'BUILDTYPE=Release',
      `PREFIX=${prefix}`,
    ],
    { cwd: sources.openh264, env: environment },
  );

  const buildDirectory = join(sources.ffmpeg, 'build-windows');
  await mkdir(buildDirectory, { recursive: true });
  // FreeType uses CreateFileA on Windows. Give every linked library the same
  // UTF-8 code page as FFmpeg, including when the install path is Japanese.
  const manifestPath = join(sources.ffmpeg, 'fftools', 'fftools.manifest');
  const manifest = await readFile(manifestPath, 'utf8');
  if (!manifest.includes('</asmv3:windowsSettings>')) {
    throw new Error('Unexpected FFmpeg Windows manifest');
  }
  await writeFile(
    manifestPath,
    manifest.replace(
      '</asmv3:windowsSettings>',
      '<activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>\n    </asmv3:windowsSettings>',
    ),
  );
  await run(
    'bash',
    [
      slash(join(sources.ffmpeg, 'configure')),
      '--target-os=mingw32',
      '--arch=x86_64',
      '--cc=gcc',
      '--cxx=g++',
      '--windres=windres',
      '--disable-autodetect',
      '--disable-doc',
      '--disable-debug',
      '--disable-ffplay',
      '--disable-network',
      '--disable-shared',
      '--enable-static',
      '--enable-libfreetype',
      '--enable-libharfbuzz',
      '--enable-libopenh264',
      '--pkg-config-flags=--static',
      '--extra-libs=-lstdc++',
      `--extra-cflags=-I${prefix}/include`,
      `--extra-ldflags=-L${prefix}/lib -static -static-libgcc -static-libstdc++`,
    ],
    { cwd: buildDirectory, env: environment },
  );
  await run('make', ['-j', parallelism, 'ffmpeg.exe', 'ffprobe.exe'], {
    cwd: buildDirectory,
    env: environment,
  });
  await mkdir(outputDirectory, { recursive: true });
  for (const name of ['ffmpeg.exe', 'ffprobe.exe']) {
    await copyFile(join(buildDirectory, name), join(outputDirectory, name));
  }
};
