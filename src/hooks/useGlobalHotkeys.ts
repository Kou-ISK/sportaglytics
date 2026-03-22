import { useEffect, useRef } from 'react';
import type { HotkeyConfig } from '../types/Settings';
import {
  findFallbackKeyUpHotkey,
  findMatchingHotkey,
  shouldIgnoreHotkeyTarget,
  shouldResetPlaybackHotkeyState,
  sortHotkeysBySpecificity,
} from './globalHotkeyUtils';

/**
 * グローバルホットキーを処理するHook
 * ウィンドウにフォーカスがある時のみ動作し、他のアプリケーションを妨害しません
 */
export const useGlobalHotkeys = (
  hotkeys: HotkeyConfig[],
  handlers: Record<string, () => void>,
  keyUpHandlers?: Record<string, () => void>,
): void => {
  // ハンドラーをuseRefで保持し、再レンダリング時にイベントリスナーが再登録されないようにする
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const keyUpHandlersRef = useRef(keyUpHandlers);
  keyUpHandlersRef.current = keyUpHandlers;

  useEffect(() => {
    const sortedHotkeys = sortHotkeysBySpecificity(hotkeys);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreHotkeyTarget(event.target)) {
        return;
      }

      const hotkey = findMatchingHotkey(event, sortedHotkeys);
      if (!hotkey) {
        return;
      }

      const handler = handlersRef.current[hotkey.id];
      if (!handler) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handler();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!keyUpHandlersRef.current) {
        return;
      }

      if (shouldIgnoreHotkeyTarget(event.target)) {
        return;
      }

      const matchedHotkey = findMatchingHotkey(event, sortedHotkeys);
      if (matchedHotkey) {
        const keyUpHandler = keyUpHandlersRef.current[matchedHotkey.id];
        if (keyUpHandler) {
          event.preventDefault();
          event.stopPropagation();
          keyUpHandler();
          return;
        }
      }

      const fallbackHotkey = findFallbackKeyUpHotkey(event, sortedHotkeys);
      if (fallbackHotkey) {
        const keyUpHandler = keyUpHandlersRef.current[fallbackHotkey.id];
        if (keyUpHandler) {
          event.preventDefault();
          event.stopPropagation();
          keyUpHandler();
          return;
        }
      }

      const resetIds = [
        'skip-forward-small',
        'skip-forward-medium',
        'skip-forward-large',
        'skip-forward-xlarge',
      ];
      if (shouldResetPlaybackHotkeyState(event)) {
        for (const id of resetIds) {
          const h = keyUpHandlersRef.current[id];
          if (h) {
            event.preventDefault();
            event.stopPropagation();
            h();
            break;
          }
        }
      }
    };

    globalThis.window.addEventListener('keydown', handleKeyDown);
    globalThis.window.addEventListener('keyup', handleKeyUp);

    return () => {
      globalThis.window.removeEventListener('keydown', handleKeyDown);
      globalThis.window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hotkeys]);
};
