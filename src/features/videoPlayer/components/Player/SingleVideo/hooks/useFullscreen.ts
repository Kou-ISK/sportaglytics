import { useState, useCallback, useEffect, useRef } from 'react';
import type Player from 'video.js/dist/types/player';
import { getNativePlayback } from '../../../../shared/nativePlayback/nativePlaybackRegistry';

interface UseFullscreenParams {
  playerRef: React.RefObject<Player | null>;
  id: string;
}

interface UseFullscreenReturn {
  isFullscreen: boolean;
  handleToggleFullscreen: () => void;
}

/**
 * Video.js プレイヤーの全画面表示状態を管理するカスタムフック
 *
 * @param playerRef - Video.js プレイヤーインスタンスへの参照
 * @param id - プレイヤーの一意なID（デバッグ用）
 * @returns 全画面表示状態とトグル関数
 */
export const useFullscreen = ({
  playerRef,
  id,
}: UseFullscreenParams): UseFullscreenReturn => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMountedRef = useRef(true);

  const handleToggleFullscreen = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      console.debug(`[useFullscreen ${id}] Player not ready`);
      return;
    }

    try {
      // Native disables Video.js controls, so its fullscreen surface must also
      // contain the existing shared toolbar and exit control.
      const root = player.el()?.closest('[data-video-fullscreen-root]');
      if (document.fullscreenElement?.contains(player.el())) {
        void document.exitFullscreen().catch((error: unknown) => {
          console.debug(`[useFullscreen ${id}] Fullscreen exit failed`, error);
        });
        return;
      }
      if (getNativePlayback() && root instanceof HTMLElement) {
        void root.requestFullscreen().catch((error: unknown) => {
          console.debug(
            `[useFullscreen ${id}] Fullscreen request failed`,
            error,
          );
        });
        return;
      }
      if (!isFullscreen) {
        // 全画面表示を要求
        if (typeof player.requestFullscreen === 'function') {
          player.requestFullscreen();
        } else {
          console.debug(
            `[useFullscreen ${id}] requestFullscreen not available`,
          );
        }
      } else {
        // 全画面表示を解除
        if (typeof player.exitFullscreen === 'function') {
          player.exitFullscreen();
        } else {
          console.debug(`[useFullscreen ${id}] exitFullscreen not available`);
        }
      }
    } catch (error) {
      console.debug(`[useFullscreen ${id}] Error toggling fullscreen:`, error);
    }
  }, [playerRef, id, isFullscreen]);

  const observedPlayer = playerRef.current;
  useEffect(() => {
    isMountedRef.current = true;
    const player = observedPlayer;
    if (!player) return;

    const handleFullscreenChange = () => {
      if (!isMountedRef.current) return;

      const currentFullscreenState =
        document.fullscreenElement?.contains(player.el()) ||
        (typeof player.isFullscreen === 'function'
          ? (player.isFullscreen() ?? false)
          : false);

      console.debug(
        `[useFullscreen ${id}] Fullscreen change:`,
        currentFullscreenState,
      );
      setIsFullscreen(currentFullscreenState);
    };

    // fullscreenchange イベントをリッスン
    if (typeof player.on === 'function') {
      player.on('fullscreenchange', handleFullscreenChange);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      try {
        player.off('fullscreenchange', handleFullscreenChange);
      } catch {
        // The document listener is already removed even if this player was disposed.
      }
    };
  }, [observedPlayer, id]);

  return { isFullscreen, handleToggleFullscreen };
};
