import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  PlaylistItem,
  PlaylistMediaResolution,
} from '../../../types/playlist/core';
import { playlistMediaKey } from '../../../shared/playlist/playlistMediaReconciliation';

interface Options {
  items: PlaylistItem[];
  currentItem: PlaylistItem | null;
  reconcile: (requested: PlaylistItem[], resolved: PlaylistItem[]) => boolean;
  setDirty: (dirty: boolean) => void;
}

export const usePlaylistMediaReferences = (
  options: Options,
): {
  loading: boolean;
  error: string;
  retry: () => void;
  relink: (target: 'primary' | 'secondary') => void;
} => {
  const latest = useRef(options);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    latest.current = options;
  }, [options]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const key = useMemo(
    () =>
      JSON.stringify(
        options.items.map((item) => [item.id, playlistMediaKey(item)]),
      ),
    [options.items],
  );
  const requestId = useRef(0);
  const retry = useCallback((): void => setRevision((value) => value + 1), []);
  const accept = useCallback(
    (requested: PlaylistItem[], result: PlaylistMediaResolution): void => {
      if (latest.current.reconcile(requested, result.items))
        latest.current.setDirty(true);
      setError(
        result.missingItemIds.length
          ? `元映像が見つからないクリップが${result.missingItemIds.length}件あります。元パッケージを接続するか、クリップ詳細から移動先を選択してください。`
          : '',
      );
    },
    [],
  );
  useEffect(() => {
    window.addEventListener('focus', retry);
    return () => window.removeEventListener('focus', retry);
  }, [retry]);
  useEffect(() => {
    const api = window.electronAPI?.playlist;
    if (!api?.resolveMediaReferences || !latest.current.items.length) {
      setLoading(false);
      setError('');
      return;
    }
    const requested = latest.current.items;
    const id = ++requestId.current;
    setLoading(true);
    void api
      .resolveMediaReferences(requested)
      .then((result) => {
        if (requestId.current === id) accept(requested, result);
      })
      .catch(() => {
        if (requestId.current === id)
          setError('映像の参照先を確認できません。再試行してください。');
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
    return () => {
      requestId.current++;
    };
  }, [key, revision, accept]);

  const relink = useCallback(
    (target: 'primary' | 'secondary'): void => {
      const current = latest.current;
      const api = window.electronAPI?.playlist;
      if (!current.currentItem || !api?.relinkPackage) return;
      const requested = current.items;
      // A native picker steals focus: background refreshes must not overwrite its result.
      void api
        .relinkPackage(requested, current.currentItem.id, target)
        .then((result) => {
          if (mounted.current && result) accept(requested, result);
        })
        .catch((cause: unknown) => {
          if (mounted.current)
            setError(
              cause instanceof Error
                ? cause.message
                : '再接続できませんでした。',
            );
        });
    },
    [accept],
  );
  return { loading, error, retry, relink };
};
