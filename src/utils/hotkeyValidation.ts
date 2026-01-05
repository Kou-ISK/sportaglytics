import type { HotkeyConfig } from '../types/Settings';

/**
 * システム予約済みキー（グローバルホットキー）
 * これらのキーはアクションボタンに割り当て不可
 */
const RESERVED_SYSTEM_KEYS = [
  'Right',
  'Shift+Right',
  'Command+Right',
  'Option+Right',
  'Left',
  'Shift+Left',
  'Up',
  'Down',
  'Command+Shift+S',
  'Command+Shift+R',
  'Command+Shift+O',
  'Command+Shift+A',
  'Command+Z',
  'Command+Shift+Z',
];

/**
 * キー文字列を正規化（大文字小文字、順序を統一）
 */
const normalizeKeyString = (key: string): string => {
  const parts = key
    .split('+')
    .map((p) => p.trim())
    .map((p) => {
      // 修飾キーを統一
      const lower = p.toLowerCase();
      if (lower === 'cmd' || lower === 'meta') return 'Command';
      if (lower === 'ctrl' || lower === 'control') return 'Control';
      if (lower === 'opt' || lower === 'alt') return 'Option';
      if (lower === 'shift') return 'Shift';
      // 通常キーは大文字に
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    });

  // 修飾キーの順序を統一: Command > Control > Option > Shift > キー
  const modifierOrder = ['Command', 'Control', 'Option', 'Shift'];
  const modifiers = parts.filter((p) => modifierOrder.includes(p));
  const keys = parts.filter((p) => !modifierOrder.includes(p));

  modifiers.sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));

  return [...modifiers, ...keys].join('+');
};

/**
 * ホットキーがシステム予約済みかチェック
 */
export const isReservedSystemKey = (hotkey: string): boolean => {
  const normalized = normalizeKeyString(hotkey);
  return RESERVED_SYSTEM_KEYS.some(
    (reserved) => normalizeKeyString(reserved) === normalized,
  );
};

/**
 * グローバルホットキー設定と重複しているかチェック
 */
export const conflictsWithGlobalHotkeys = (
  hotkey: string,
  globalHotkeys: HotkeyConfig[],
): boolean => {
  const normalized = normalizeKeyString(hotkey);
  return globalHotkeys.some(
    (config) =>
      !config.disabled && normalizeKeyString(config.key) === normalized,
  );
};

/**
 * 他のアクションボタンと重複しているかチェック
 */
export const conflictsWithActionHotkeys = (
  hotkey: string,
  existingHotkeys: string[],
  excludeIndex?: number,
): boolean => {
  const normalized = normalizeKeyString(hotkey);
  return existingHotkeys.some(
    (existing, index) =>
      index !== excludeIndex && normalizeKeyString(existing) === normalized,
  );
};

/**
 * ホットキーの妥当性を検証し、エラーメッセージを返す
 * @returns エラーメッセージ（問題なければnull）
 */
export const validateActionHotkey = (
  hotkey: string,
  globalHotkeys: HotkeyConfig[],
  existingActionHotkeys: string[],
  excludeIndex?: number,
): string | null => {
  if (!hotkey || hotkey.trim() === '') {
    return null; // 空は許可（ホットキーなし）
  }

  const trimmed = hotkey.trim();

  // システム予約キーチェック
  if (isReservedSystemKey(trimmed)) {
    return `キー "${trimmed}" はシステム予約済みです。別のキーを選択してください。`;
  }

  // グローバルホットキーと重複チェック
  if (conflictsWithGlobalHotkeys(trimmed, globalHotkeys)) {
    return `キー "${trimmed}" は既にグローバルホットキーで使用されています。`;
  }

  // 他のアクションボタンと重複チェック
  if (
    conflictsWithActionHotkeys(trimmed, existingActionHotkeys, excludeIndex)
  ) {
    return `キー "${trimmed}" は既に他のアクションで使用されています。`;
  }

  return null;
};

/**
 * 予約キーの一覧を取得（UI表示用）
 */
export const getReservedKeysList = (): string[] => {
  return [...RESERVED_SYSTEM_KEYS];
};
