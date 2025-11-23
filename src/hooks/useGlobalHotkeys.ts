import { useEffect } from 'react';
import type { HotkeyConfig } from '../types/Settings';

/**
 * Electronのキー文字列をKeyboardEventのプロパティにマッピング
 * 例: "Command+Shift+A" -> { metaKey: true, shiftKey: true, key: "a" }
 */
interface KeyboardModifiers {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
}

/**
 * Electronのキー文字列をパースしてKeyboardModifiersに変換
 */
const parseElectronKey = (electronKey: string): KeyboardModifiers => {
  const parts = electronKey.split('+');
  const modifiers: KeyboardModifiers = {
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    key: '',
  };

  for (const part of parts) {
    const trimmed = part.trim();
    const normalized = trimmed.toLowerCase();
    if (
      normalized === 'command' ||
      normalized === 'cmd' ||
      normalized === 'meta'
    ) {
      modifiers.metaKey = true;
    } else if (normalized === 'control' || normalized === 'ctrl') {
      modifiers.ctrlKey = true;
    } else if (normalized === 'shift') {
      modifiers.shiftKey = true;
    } else if (normalized === 'alt' || normalized === 'option') {
      modifiers.altKey = true;
    } else if (normalized === 'right') {
      modifiers.key = 'arrowright';
    } else if (normalized === 'left') {
      modifiers.key = 'arrowleft';
    } else if (normalized === 'up') {
      modifiers.key = 'arrowup';
    } else if (normalized === 'down') {
      modifiers.key = 'arrowdown';
    } else {
      // アルファベットや数字はそのまま小文字で保存
      modifiers.key = trimmed.toLowerCase();
    }
  }

  return modifiers;
};

/**
 * KeyboardEventが指定されたmodifiersと一致するかチェック
 */
const matchesModifiers = (
  event: KeyboardEvent,
  modifiers: KeyboardModifiers,
): boolean => {
  return (
    event.ctrlKey === modifiers.ctrlKey &&
    event.shiftKey === modifiers.shiftKey &&
    event.altKey === modifiers.altKey &&
    event.metaKey === modifiers.metaKey &&
    event.key.toLowerCase() === modifiers.key
  );
};

/**
 * グローバルホットキーを処理するHook
 * ウィンドウにフォーカスがある時のみ動作し、他のアプリケーションを妨害しません
 */
export const useGlobalHotkeys = (
  hotkeys: HotkeyConfig[],
  handlers: Record<string, () => void>,
) => {
  useEffect(() => {
    console.log('[useGlobalHotkeys] Registering hotkeys:', hotkeys.length);

    const handleKeyDown = (event: KeyboardEvent) => {
      // input/textarea等のフォーカス時はホットキーを無効化
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      console.log('[useGlobalHotkeys] Key pressed:', {
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });

      // 各ホットキーをチェック
      for (const hotkey of hotkeys) {
        const modifiers = parseElectronKey(hotkey.key);
        console.log(
          '[useGlobalHotkeys] Checking hotkey:',
          hotkey.key,
          'parsed:',
          modifiers,
        );

        if (matchesModifiers(event, modifiers)) {
          console.log('[useGlobalHotkeys] Hotkey matched:', hotkey.id);
          const handler = handlers[hotkey.id];
          if (handler) {
            event.preventDefault();
            event.stopPropagation();
            handler();
          } else {
            console.warn('[useGlobalHotkeys] No handler found for:', hotkey.id);
          }
          break;
        }
      }
    };

    // グローバルにkeydownイベントをリッスン
    globalThis.window.addEventListener('keydown', handleKeyDown);
    console.log('[useGlobalHotkeys] Event listener registered');

    return () => {
      globalThis.window.removeEventListener('keydown', handleKeyDown);
      console.log('[useGlobalHotkeys] Event listener removed');
    };
  }, [hotkeys, handlers]);
};
