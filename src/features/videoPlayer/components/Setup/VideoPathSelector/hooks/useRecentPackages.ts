import { useState, useEffect, useCallback } from 'react';
import type { RecentPackage } from '../types';
import {
  clearRecentPackagesStorage,
  loadRecentPackagesFromStorage,
  MAX_RECENT_PACKAGES,
  saveRecentPackagesToStorage,
  syncRecentPackagesMenu,
} from '../gateway/recentPackagesGateway';

export type { RecentPackage } from '../types';

interface RecentPackagesState {
  recentPackages: RecentPackage[];
  addRecentPackage: (packageInfo: Omit<RecentPackage, 'lastOpened'>) => void;
  removeRecentPackage: (path: string) => void;
  clearRecentPackages: () => void;
}

export const useRecentPackages = (): RecentPackagesState => {
  const [recentPackages, setRecentPackages] = useState<RecentPackage[]>([]);

  useEffect(() => {
    setRecentPackages(loadRecentPackagesFromStorage());
  }, []);

  const addRecentPackage = useCallback(
    (packageInfo: Omit<RecentPackage, 'lastOpened'>) => {
      // Metadata loading can finish after the launcher unmounts. Persist before
      // updating React state, and merge against storage shared by live windows.
      const updated = [
        { ...packageInfo, lastOpened: Date.now() },
        ...loadRecentPackagesFromStorage().filter(
          (p) => p.path !== packageInfo.path,
        ),
      ].slice(0, MAX_RECENT_PACKAGES);
      saveRecentPackagesToStorage(updated);
      syncRecentPackagesMenu(updated);
      setRecentPackages(updated);
    },
    [],
  );

  const removeRecentPackage = useCallback((path: string) => {
    const updated = loadRecentPackagesFromStorage().filter(
      (p) => p.path !== path,
    );
    saveRecentPackagesToStorage(updated);
    syncRecentPackagesMenu(updated);
    setRecentPackages(updated);
  }, []);

  const clearRecentPackages = useCallback(() => {
    setRecentPackages([]);
    clearRecentPackagesStorage();
    syncRecentPackagesMenu([]);
  }, []);

  return {
    recentPackages,
    addRecentPackage,
    removeRecentPackage,
    clearRecentPackages,
  };
};
