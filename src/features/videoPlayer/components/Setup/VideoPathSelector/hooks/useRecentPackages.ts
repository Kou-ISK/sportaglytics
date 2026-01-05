import { useState, useEffect, useCallback } from 'react';

export interface RecentPackage {
  path: string;
  name: string;
  team1Name: string;
  team2Name: string;
  lastOpened: number;
  videoCount: number;
}

const STORAGE_KEY = 'sportaglytics-recent-packages';
const MAX_RECENT_PACKAGES = 6;

export const useRecentPackages = () => {
  const [recentPackages, setRecentPackages] = useState<RecentPackage[]>([]);

  // LocalStorageから履歴を読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentPackage[];
        // 日付でソート（新しい順） - ES2023のtoSorted()は互換性のためスプレッド+sort()に変更
        const sorted = [...parsed].sort((a, b) => b.lastOpened - a.lastOpened);
        setRecentPackages(sorted.slice(0, MAX_RECENT_PACKAGES));
      }
    } catch (error) {
      console.error('Failed to load recent packages:', error);
    }
  }, []);

  // 履歴をLocalStorageに保存
  const saveToStorage = useCallback((packages: RecentPackage[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
    } catch (error) {
      console.error('Failed to save recent packages:', error);
    }
  }, []);

  // 新しいパッケージを履歴に追加
  const addRecentPackage = useCallback(
    (packageInfo: Omit<RecentPackage, 'lastOpened'>) => {
      setRecentPackages((prev) => {
        // 既存の同じパスのエントリを削除
        const filtered = prev.filter((p) => p.path !== packageInfo.path);

        // 新しいエントリを先頭に追加
        const updated = [
          {
            ...packageInfo,
            lastOpened: Date.now(),
          },
          ...filtered,
        ].slice(0, MAX_RECENT_PACKAGES);

        saveToStorage(updated);
        // メニューバー用にElectronへ同期
        try {
          globalThis.window.electronAPI?.updateRecentPackages?.(
            updated.map((p) => p.path),
          );
        } catch (error) {
          console.warn('Failed to sync recent packages to menu:', error);
        }
        return updated;
      });
    },
    [saveToStorage],
  );

  // 特定のパッケージを履歴から削除
  const removeRecentPackage = useCallback(
    (path: string) => {
      setRecentPackages((prev) => {
        const updated = prev.filter((p) => p.path !== path);
        saveToStorage(updated);
        try {
          globalThis.window.electronAPI?.updateRecentPackages?.(
            updated.map((p) => p.path),
          );
        } catch (error) {
          console.warn('Failed to sync recent packages to menu:', error);
        }
        return updated;
      });
    },
    [saveToStorage],
  );

  // 履歴を全てクリア
  const clearRecentPackages = useCallback(() => {
    setRecentPackages([]);
    localStorage.removeItem(STORAGE_KEY);
    try {
      globalThis.window.electronAPI?.updateRecentPackages?.([]);
    } catch (error) {
      console.warn('Failed to clear recent packages in menu:', error);
    }
  }, []);

  return {
    recentPackages,
    addRecentPackage,
    removeRecentPackage,
    clearRecentPackages,
  };
};
