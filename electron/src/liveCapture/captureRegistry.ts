import * as path from 'node:path';
import { normalizePackagePath } from '../packageSessionRegistry';

// Process-local ownership: an interrupted application never leaves a persistent lock.
const activePackages = new Set<string>();
export const setPackageCaptureActive = (
  directory: string,
  active: boolean,
): void => {
  const key = normalizePackagePath(directory);
  if (active) activePackages.add(key);
  else activePackages.delete(key);
};
export const isPackageCaptureActive = (directory: string): boolean =>
  activePackages.has(normalizePackagePath(directory));
export const assertCaptureConfigEditable = (configPath: string): void => {
  if (isPackageCaptureActive(path.dirname(path.dirname(configPath))))
    throw new Error(
      '録画中は映像の同期配置を変更できません。録画を停止してから同期してください。',
    );
};
