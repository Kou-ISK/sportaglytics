import { useEffect, useRef } from 'react';
import type { HotkeyConfig } from '../types/settings/coreTypes';
import {
  findFallbackKeyUpHotkey,
  findMatchingHotkey,
  shouldIgnoreHotkeyTarget,
  shouldResetPlaybackHotkeyState,
  sortHotkeysBySpecificity,
} from './globalHotkeyUtils';

const heldPlaybackIds = new Set([
  'skip-forward-small',
  'skip-forward-medium',
  'skip-forward-large',
  'skip-forward-xlarge',
  'reverse-playback-slow',
  'reverse-playback-2x',
  'reverse-playback-4x',
  'reverse-playback-6x',
]);

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

  const heldPlayback = useRef<{ id: string; physicalKey: string } | null>(null);

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
      // A shortcut represents one user action per physical key press. Keep
      // suppressing the browser default during OS key repeat, but do not run
      // toggle actions (play/pause and coding buttons) again.
      if (event.repeat) {
        return;
      }
      if (
        heldPlaybackIds.has(hotkey.id) &&
        keyUpHandlersRef.current?.[hotkey.id]
      ) {
        heldPlayback.current = {
          id: hotkey.id,
          physicalKey: event.code || event.key.toLowerCase(),
        };
      }
      handler();
    };

    // Editors can consume keyup before it bubbles to the window. Finish only
    // a hold started by this hook and leave the editor's event untouched.
    const captureHeldRelease = (event: KeyboardEvent): void => {
      const held = heldPlayback.current;
      if (!held || held.physicalKey !== (event.code || event.key.toLowerCase()))
        return;
      heldPlayback.current = null;
      if (shouldIgnoreHotkeyTarget(event.target))
        keyUpHandlersRef.current?.[held.id]?.();
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

      if (shouldResetPlaybackHotkeyState(event)) {
        heldPlayback.current = null;
        for (const id of heldPlaybackIds) {
          const h = keyUpHandlersRef.current[id];
          if (h) {
            event.preventDefault();
            event.stopPropagation();
            h();
          }
        }
      }
    };

    const handleBlur = (): void => {
      heldPlayback.current = null;
      const handlers = keyUpHandlersRef.current;
      if (!handlers) return;
      for (const id of heldPlaybackIds) {
        handlers[id]?.();
      }
    };

    globalThis.window.addEventListener('keydown', handleKeyDown);
    globalThis.window.addEventListener('keyup', captureHeldRelease, true);
    globalThis.window.addEventListener('keyup', handleKeyUp);
    globalThis.window.addEventListener('blur', handleBlur);

    return () => {
      globalThis.window.removeEventListener('keydown', handleKeyDown);
      globalThis.window.removeEventListener('keyup', captureHeldRelease, true);
      globalThis.window.removeEventListener('keyup', handleKeyUp);
      globalThis.window.removeEventListener('blur', handleBlur);
    };
  }, [hotkeys]);
};
