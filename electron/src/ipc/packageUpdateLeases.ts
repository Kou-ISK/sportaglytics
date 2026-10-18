import { normalizePackagePath } from '../packageSessionRegistry';

const updating = new Set<string>();
export const isPackageUpdating = (file: string): boolean =>
  updating.has(normalizePackagePath(file));
export const reservePackageUpdates = (files: string[]): (() => void) => {
  const keys = [...new Set(files.map(normalizePackagePath))];
  if (keys.some((key) => updating.has(key)))
    throw new Error('PACKAGE_UPDATE_BUSY');
  keys.forEach((key) => updating.add(key));
  return () => {
    keys.forEach((key) => updating.delete(key));
  };
};
