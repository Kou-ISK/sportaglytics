import { useCallback } from 'react';
import videojs from 'video.js';

export type VideoJsPlayerHandle = {
  isDisposed?: () => boolean;
  readyState?: () => number;
  play?: () => Promise<void> | void;
  pause?: () => void;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  muted?: (val: boolean) => void;
  ready?: (cb: () => void) => void;
  currentTime?: (time?: number) => number;
  duration?: () => number;
};

export type GetExistingVideoJsPlayer = (
  id: string,
) => VideoJsPlayerHandle | undefined;

type VideoJsNamespace = {
  (el: string): VideoJsPlayerHandle | undefined;
  getPlayer?: (id: string) => VideoJsPlayerHandle | undefined;
};

export const useExistingVideoJsPlayer = (): GetExistingVideoJsPlayer =>
  useCallback((id: string) => {
    try {
      const anyVjs: VideoJsNamespace = videojs as unknown as VideoJsNamespace;

      if (typeof anyVjs.getPlayer === 'function') {
        const player = anyVjs.getPlayer?.(id);
        if (player && !player.isDisposed?.()) return player;
      }

      // ここで videojs(id) を呼ぶと新規生成される可能性があるため禁止
      return undefined;
    } catch (error) {
      console.debug('getExistingPlayer error', error);
      return undefined;
    }
  }, []);
