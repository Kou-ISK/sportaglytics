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

export const useRecentPackages = () => {
  const [recentPackages, setRecentPackages] = useState<RecentPackage[]>([]);

  useEffect(() => {
    setRecentPackages(loadRecentPackagesFromStorage());
  }, []);

  const addRecentPackage = useCallback(
    (packageInfo: Omit<RecentPackage, 'lastOpened'>) => {
      setRecentPackages((prev) => {
        const filtered = prev.filter((p) => p.path !== packageInfo.path);
        const updated = [
          {
            ...packageInfo,
            lastOpened: Date.now(),
          },
          ...filtered,
        ].slice(0, MAX_RECENT_PACKAGES);

        saveRecentPackagesToStorage(updated);
        syncRecentPackagesMenu(updated);
        return updated;
      });
    },
    [],
  );

  const removeRecentPackage = useCallback((path: string) => {
    setRecentPackages((prev) => {
      const updated = prev.filter((p) => p.path !== path);
      saveRecentPackagesToStorage(updated);
      syncRecentPackagesMenu(updated);
      return updated;
    });
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
