// Local unsigned preview only. The normal distribution config remains separate.
const base = require('./electron-builder.json');
module.exports = {
  ...base,
  publish: null,
  forceCodeSigning: false,
  afterPack: './scripts/macos/after-pack.mjs',
  mac: {
    ...base.mac,
    publish: null,
    identity: null,
    notarize: false,
    target: 'dir',
    extraResources: [
      ...base.mac.extraResources,
      {
        from: '.cache/native-playback/darwin-arm64',
        to: 'native-playback',
        filter: [
          'NativeProductHost',
          'Receiver.node',
          'build.json',
          'licenses/**/*',
        ],
      },
    ],
  },
};
