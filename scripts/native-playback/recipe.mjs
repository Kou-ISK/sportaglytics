import { SOURCES } from '../media-tools/sources.mjs';

export const BUILD_REVISION = 4;
export const BUILD_INPUT_FILES = [
  'scripts/build-native-playback.mjs',
  'scripts/native-playback/recipe.mjs',
  'scripts/native-playback/manifest.mjs',
  'scripts/native-playback/worker-thread-qos.mjs',
  'scripts/native-playback/WorkerThreadQoS.h',
  'scripts/download-verified.mjs',
  'scripts/media-tools/process.mjs',
  'scripts/media-tools/source-download.mjs',
  'scripts/media-tools/sources.mjs',
  'native/macos/playback/source-files.json',
  'native/macos/playback/NOTICE.md',
  'LICENSE',
];
export const MINIMUM_MACOS = '13.0';
export const NODE_HEADERS = {
  version: '22.12.0',
  directory: 'node-v22.12.0',
  url: 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-headers.tar.xz',
  sha256: '3cde28bb5820cf0f7593c7817c7a9ab1f15016dd85a6e5c240bbdf2a9c59130d',
};
export const UPSTREAM = { ffmpeg: SOURCES.ffmpeg, node: NODE_HEADERS };
export const NODE_LICENSE = {
  url: 'https://raw.githubusercontent.com/nodejs/node/v22.12.0/LICENSE',
  sha256: '9d72cce9b104ecb67feb8af38618511685190ae5a119cc0488ecae66b221000d',
};
export const LIBRARIES = ['avformat', 'avcodec', 'avfilter', 'avutil'];
export const HOST_SOURCES = [
  'host-embedded/NativeProductHost.mm',
  'host-embedded/NativeSupport.mm',
  'host-embedded/VideoFeed.mm',
  'host-embedded/AudioPCMWindow.mm',
  'host-embedded/PCMWindowSupply.mm',
  'host-embedded/VideoWorkerCompletion.mm',
  'direct-frame-handoff/DirectVideoFeed.mm',
  'direct-frame-handoff/FrameDeliveryLease.mm',
  'direct-frame-handoff/DirectFrameReader.cpp',
  'direct-frame-handoff/DirectFieldCopy.cpp',
  'direct-frame-handoff/DeferredFieldImage.mm',
  'recurrence/Recorder.mm',
];
export const FRAMEWORKS = [
  'Foundation',
  'AppKit',
  'AVFoundation',
  'CoreMedia',
  'CoreVideo',
  'IOSurface',
  'AudioToolbox',
  'QuartzCore',
];
// Deliberately preserve the qualified decoder profile. No hardware decoder,
// network protocol, full-file conversion, or additional codec is introduced.
export const FFMPEG_FLAGS = [
  '--target-os=darwin',
  '--arch=aarch64',
  '--cc=clang',
  '--disable-autodetect',
  '--disable-everything',
  '--disable-programs',
  '--disable-doc',
  '--disable-debug',
  '--disable-network',
  '--disable-avdevice',
  '--disable-swscale',
  '--disable-swresample',
  '--disable-shared',
  '--enable-static',
  '--enable-pthreads',
  '--enable-decoder=h264',
  '--enable-parser=h264',
  '--enable-demuxer=mov',
  '--enable-protocol=file',
  '--enable-filter=bwdif,trim',
  `--extra-cflags=-arch arm64 -mmacosx-version-min=${MINIMUM_MACOS}`,
  `--extra-ldflags=-arch arm64 -mmacosx-version-min=${MINIMUM_MACOS}`,
];
