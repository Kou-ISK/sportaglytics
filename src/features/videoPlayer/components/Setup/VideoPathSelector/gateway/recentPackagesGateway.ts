import type { RecentPackage } from '../types';

const STORAGE_KEY = 'sportaglytics-recent-packages';
export const MAX_RECENT_PACKAGES = 6;

const isRecentPackage = (value: unknown): value is RecentPackage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.path === 'string' &&
    typeof record.name === 'string' &&
    typeof record.team1Name === 'string' &&
    typeof record.team2Name === 'string' &&
    typeof record.lastOpened === 'number' &&
    typeof record.videoCount === 'number'
  );
};

export const loadRecentPackagesFromStorage = (): RecentPackage[] => {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecentPackage)
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .slice(0, MAX_RECENT_PACKAGES);
  } catch (error) {
    console.error('Failed to load recent packages:', error);
    return [];
  }
};

export const saveRecentPackagesToStorage = (
  packages: RecentPackage[],
): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  } catch (error) {
    console.error('Failed to save recent packages:', error);
  }
};

export const clearRecentPackagesStorage = (): void => {
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear recent packages:', error);
  }
};

export const syncRecentPackagesMenu = (packages: RecentPackage[]): void => {
  try {
    globalThis.window.electronAPI?.updateRecentPackages?.(
      packages.map((entry) => entry.path),
    );
  } catch (error) {
    console.warn('Failed to sync recent packages to menu:', error);
  }
};
