import { SOURCES } from './sources.mjs';

export const BUNDLE_TARGETS = {
  all: ['darwin-x64', 'darwin-arm64', 'win32-x64'],
  macos: ['darwin-x64', 'darwin-arm64'],
  windows: ['win32-x64'],
};

export const sourceBundleOptions = (args) => {
  let platform = 'all';
  let requireBuilds = false;
  let selected = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--require-builds') requireBuilds = true;
    else if (args[index] === '--platform' && !selected) {
      platform = args[++index];
      selected = true;
    } else
      throw new Error(
        `Unknown or repeated source bundle option: ${args[index]}`,
      );
  }
  if (!Object.hasOwn(BUNDLE_TARGETS, platform))
    throw new Error('Source bundle platform must be all, macos, or windows');
  return { platform, requireBuilds, targets: BUNDLE_TARGETS[platform] };
};

export const sourcesForTargets = (targets) => {
  if (
    !targets.length ||
    targets.some((target) => !BUNDLE_TARGETS.all.includes(target))
  )
    throw new Error('Unsupported source bundle target');
  const windows = targets.includes('win32-x64');
  return Object.fromEntries(
    Object.entries(SOURCES).filter(
      ([name]) => windows || name !== 'zlib',
    ),
  );
};
