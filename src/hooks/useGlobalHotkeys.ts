import { useEffect, useRef } from 'react';
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
 * 全ての修飾キーとキー自体が完全に一致する必要がある
 */
const matchesModifiers = (
  event: KeyboardEvent,
  modifiers: KeyboardModifiers,
): boolean => {
  // 全ての修飾キーが完全一致する必要がある
  const modifiersMatch =
    event.ctrlKey === modifiers.ctrlKey &&
    event.shiftKey === modifiers.shiftKey &&
    event.altKey === modifiers.altKey &&
    event.metaKey === modifiers.metaKey;

  // キー自体も一致する必要がある
  const keyMatch = event.key.toLowerCase() === modifiers.key;

  return modifiersMatch && keyMatch;
};

/**
 * グローバルホットキーを処理するHook
 * ウィンドウにフォーカスがある時のみ動作し、他のアプリケーションを妨害しません
 */
export const useGlobalHotkeys = (
  hotkeys: HotkeyConfig[],
  handlers: Record<string, () => void>,
) => {
  // ハンドラーをuseRefで保持し、再レンダリング時にイベントリスナーが再登録されないようにする
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    console.log('[useGlobalHotkeys] Registering hotkeys:', hotkeys.length);

    // 修飾キーが多い順にソート（Shift+Right が Right より先にマッチするように）
    const sortedHotkeys = [...hotkeys]
      .filter((h) => !h.disabled)
      .sort((a, b) => {
        const countModifiers = (key: string) => {
          const parts = key.split('+');
          return parts.length - 1; // キー自体を除いた修飾キーの数
        };
        return countModifiers(b.key) - countModifiers(a.key);
      });

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

      // 各ホットキーをチェック（修飾キーが多い順）
      for (const hotkey of sortedHotkeys) {
        const modifiers = parseElectronKey(hotkey.key);
        const matches = matchesModifiers(event, modifiers);

        if (matches) {
          console.log(
            '[useGlobalHotkeys] ✓ Hotkey matched:',
            hotkey.id,
            'key:',
            hotkey.key,
            'event:',
            {
              key: event.key,
              ctrl: event.ctrlKey,
              shift: event.shiftKey,
              alt: event.altKey,
              meta: event.metaKey,
            },
          );

          // 最新のhandlersを使用
          const handler = handlersRef.current[hotkey.id];
          if (handler) {
            // イベントの伝播を確実に止める
            event.preventDefault();
            event.stopPropagation();
            handler();
            return; // 最初にマッチしたホットキーのみ実行
          } else {
            console.warn('[useGlobalHotkeys] No handler found for:', hotkey.id);
          }
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
  }, [hotkeys]); // handlersを依存配列から除外
};
