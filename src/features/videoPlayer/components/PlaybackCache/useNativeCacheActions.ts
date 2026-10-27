import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getNativePlayback,
  restoreNativeBeforeDocumentChange,
} from '../../shared/nativePlayback/nativePlaybackRegistry';
import type { usePlaybackCacheController } from './usePlaybackCacheController';

type CacheController = ReturnType<typeof usePlaybackCacheController>;
/** A cache request owns the transition; native mode is never a user setting. */
export const useNativeCacheActions = (
  cache: CacheController,
): {
  onUseCache: () => void;
  onUseOriginal: () => void;
  switching: boolean;
  error: string | null;
} => {
  const current = useRef(cache);
  current.current = cache;
  const alive = useRef(true);
  const working = useRef(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const useSource = useCallback((copy: boolean): void => {
    if (working.current) return;
    const invoke = (): void => {
      if (copy) current.current.onUseCache();
      else current.current.onUseOriginal();
    };
    const native = getNativePlayback();
    if (!native) {
      invoke();
      return;
    }
    const source = current.current.snapshot?.source?.url;
    const generation = current.current.snapshot?.generation;
    if (!source || native.sourceUrl !== source) {
      setError('再生用コピーの対象映像を確認できませんでした。');
      return;
    }
    working.current = true;
    setSwitching(true);
    setError(null);
    void restoreNativeBeforeDocumentChange()
      .then(() => {
        const next = current.current.snapshot;
        if (
          !alive.current ||
          !next ||
          next.generation !== generation ||
          next.source?.url !== source
        )
          return;
        invoke();
      })
      .catch(() => {
        if (alive.current)
          setError(
            '再生の復旧を確認できないため、コピーへ切り替えませんでした。',
          );
      })
      .finally(() => {
        working.current = false;
        if (alive.current) setSwitching(false);
      });
  }, []);
  return {
    onUseCache: () => useSource(true),
    onUseOriginal: () => useSource(false),
    switching,
    error,
  };
};
