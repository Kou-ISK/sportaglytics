export const primaryModifier =
  process.platform === 'darwin' ? 'Meta' : 'Control';
export const primaryModifierEvent =
  process.platform === 'darwin'
    ? { metaKey: true, ctrlKey: false }
    : { metaKey: false, ctrlKey: true };
export const fixtureH264Encoder =
  process.platform === 'darwin'
    ? 'h264_videotoolbox'
    : process.platform === 'win32'
      ? 'libopenh264'
      : 'libx264';
