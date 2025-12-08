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
    } else if (normalized === 'space') {
      modifiers.key = ' ';
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
  // Spaceキーの特殊処理: event.keyは' 'だが、比較用に変換しない
  let eventKey: string;
  if (event.key === ' ') {
    eventKey = ' '; // スペースキーはそのまま
  } else {
    // Shiftキー押下時は event.key が大文字や記号になるため、toLowerCase() で比較
    eventKey = event.key.toLowerCase();
  }

  let keyMatch = eventKey === modifiers.key;

  // 数字キーの場合、Shift押下時は記号になるため event.code でも照合
  // 例: Shift+1 → event.key="!", event.code="Digit1"
  if (!keyMatch && modifiers.shiftKey && /^\d$/.test(modifiers.key)) {
    const expectedCode = `Digit${modifiers.key}`;
    keyMatch = event.code === expectedCode;
  }

  return modifiersMatch && keyMatch;
};

/**
 * グローバルホットキーを処理するHook
 * ウィンドウにフォーカスがある時のみ動作し、他のアプリケーションを妨害しません
 */
export const useGlobalHotkeys = (
  hotkeys: HotkeyConfig[],
  handlers: Record<string, () => void>,
  keyUpHandlers?: Record<string, () => void>,
) => {
  // ハンドラーをuseRefで保持し、再レンダリング時にイベントリスナーが再登録されないようにする
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const keyUpHandlersRef = useRef(keyUpHandlers);
  keyUpHandlersRef.current = keyUpHandlers;

  useEffect(() => {
    console.log('[useGlobalHotkeys] Registering hotkeys:', hotkeys.length);
    console.log(
      '[useGlobalHotkeys] Hotkeys list:',
      hotkeys.map((h) => ({ id: h.id, key: h.key, disabled: h.disabled })),
    );
    console.log('[useGlobalHotkeys] Handlers:', Object.keys(handlers));

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

    const handleKeyUp = (event: KeyboardEvent) => {
      // keyUpハンドラーが登録されていない場合はスキップ
      if (!keyUpHandlersRef.current) {
        return;
      }

      // input/textarea等のフォーカス時はホットキーを無効化
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      let matched = false;
      // 各ホットキーをチェック（修飾キーが多い順）
      for (const hotkey of sortedHotkeys) {
        const modifiers = parseElectronKey(hotkey.key);
        const matches = matchesModifiers(event, modifiers);

        if (matches) {
          matched = true;
          const keyUpHandler = keyUpHandlersRef.current[hotkey.id];
          if (keyUpHandler) {
            event.preventDefault();
            event.stopPropagation();
            keyUpHandler();
            return;
          }
        }
      }

      // 予備: 修飾キーを無視して key のみ一致を許可（Command押下の解除順による取りこぼし対策）
      const plainKey = event.key.toLowerCase();
      // 修飾キーの有無に関わらず、キー本体でフォールバック（特にCommand+Rightの解除順対策）
      if (!matched) {
        for (const hotkey of sortedHotkeys) {
          const modifiers = parseElectronKey(hotkey.key);
          const expectKey = modifiers.key;
          if (plainKey === expectKey) {
            const keyUpHandler = keyUpHandlersRef.current[hotkey.id];
            if (keyUpHandler) {
              event.preventDefault();
              event.stopPropagation();
              keyUpHandler();
              return;
            }
          }
        }
      }

      // 速度系の最終フォールバック: Right系またはMeta/Commandキーアップで必ずリセット
      // macOSではCmdを離すとmetaKey=falseになった状態でkeyupが発火するため
      // Rightキーだけでなく、Metaキーが離された場合も速度をリセットする
      const resetIds = [
        'skip-forward-small',
        'skip-forward-medium',
        'skip-forward-large',
        'skip-forward-xlarge',
      ];
      const shouldReset =
        plainKey === 'arrowright' ||
        plainKey === 'right' ||
        plainKey === 'meta' ||
        event.key === 'Meta' ||
        event.code === 'MetaLeft' ||
        event.code === 'MetaRight';
      if (shouldReset) {
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

    // グローバルにkeydownイベントをリッスン
    globalThis.window.addEventListener('keydown', handleKeyDown);
    globalThis.window.addEventListener('keyup', handleKeyUp);
    console.log('[useGlobalHotkeys] Event listeners registered');

    return () => {
      globalThis.window.removeEventListener('keydown', handleKeyDown);
      globalThis.window.removeEventListener('keyup', handleKeyUp);
      console.log('[useGlobalHotkeys] Event listeners removed');
    };
  }, [hotkeys]); // handlersを依存配列から除外
};
