import { SOURCES } from './sources.mjs';

export const validateBuildManifest = (manifest, target) => {
  const [platform, architecture] = target.split('-');
  if (
    manifest.identity?.platform !== platform ||
    manifest.identity?.architecture !== architecture
  )
    throw new Error(`Build target mismatch: ${target}`);
  const names = Object.keys(SOURCES).filter(
    (name) => platform === 'win32' || !['zlib', 'openh264'].includes(name),
  );
  if (
    Object.keys(manifest.identity.sources ?? {})
      .sort()
      .join() !== names.sort().join()
  )
    throw new Error(`Incomplete source identity: ${target}`);
  for (const name of names) {
    const source = manifest.identity.sources[name];
    if (
      source.sha256 !== SOURCES[name].sha256 ||
      source.version !== SOURCES[name].version
    )
      throw new Error(`Source identity mismatch: ${target}/${name}`);
  }
  for (const name of ['ffmpeg', 'ffprobe']) {
    if (!/^[a-f0-9]{64}$/.test(manifest.binaries?.[name] ?? ''))
      throw new Error(`Missing binary identity: ${target}/${name}`);
  }
  // Publish the defined build contract only, not unexpected local diagnostic fields.
  return {
    identity: {
      revision: manifest.identity.revision,
      platform,
      architecture,
      sources: Object.fromEntries(
        names.map((name) => [
          name,
          { version: SOURCES[name].version, sha256: SOURCES[name].sha256 },
        ]),
      ),
    },
    binaries: {
      ffmpeg: manifest.binaries.ffmpeg,
      ffprobe: manifest.binaries.ffprobe,
    },
  };
};
