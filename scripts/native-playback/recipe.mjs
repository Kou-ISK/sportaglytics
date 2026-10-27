export const BUILD_REVISION = 6;
export const BUILD_INPUT_FILES = [
  'scripts/build-native-playback.mjs',
  'scripts/native-playback/recipe.mjs',
  'scripts/native-playback/manifest.mjs',
  'scripts/download-verified.mjs',
  'scripts/media-tools/process.mjs',
  'scripts/media-tools/source-download.mjs',
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
export const UPSTREAM = { node: NODE_HEADERS };
export const NODE_LICENSE = {
  url: 'https://raw.githubusercontent.com/nodejs/node/v22.12.0/LICENSE',
  sha256: '9d72cce9b104ecb67feb8af38618511685190ae5a119cc0488ecae66b221000d',
};
export const HOST_SOURCES = [
  'apple-export/AppleClipExport.mm',
  'apple-player/ApplePlayerSession.mm',
  'apple-player/ApplePlayerHost.mm',
];
export const FRAMEWORKS = [
  'Foundation',
  'AppKit',
  'AVFoundation',
  'CoreMedia',
  'CoreVideo',
  'IOSurface',
  'QuartzCore',
];
