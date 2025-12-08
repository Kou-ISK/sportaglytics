/**
 * アクションプリセット定義
 */
export interface ActionPreset {
  /** プリセットの一意なID */
  id: string;
  /** プリセット名 */
  name: string;
  /** このプリセットに含まれるアクション */
  actions: ActionDefinition[];
  /** 並び順 */
  order: number;
  /** デフォルトプリセットフラグ（削除不可、IDは固定） */
  isDefault?: boolean;
}

/**
 * アクショングループ定義（group > name構造）
 */
export interface ActionGroup {
  /** グループ名（例: "Result", "Type", "Category"など自由に設定可能） */
  groupName: string;
  /** グループ内の選択肢リスト */
  options: string[];
}

/**
 * 個別のアクション定義
 */
export interface ActionDefinition {
  /** アクション名 */
  action: string;
  /** 結果の選択肢リスト（後方互換性のため残す） */
  results: string[];
  /** タイプの選択肢リスト（後方互換性のため残す） */
  types: string[];
  /** グループ構造（新しい柔軟な構造） */
  groups?: ActionGroup[];
  /** ホットキー（オプション）例: "a", "Shift+B", "1" */
  hotkey?: string;
}

/**
 * ホットキー設定
 */
export interface HotkeyConfig {
  /** コマンドID */
  id: string;
  /** コマンドの説明 */
  label: string;
  /** キーバインド（例: "Command+Shift+S"） */
  key: string;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * テーマモード
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * アプリケーション設定全体
 */
export interface AppSettings {
  /** テーマモード */
  themeMode: ThemeMode;
  /** 現在アクティブなプリセットID */
  activePresetId: string;
  /** カスタムアクションプリセット */
  actionPresets: ActionPreset[];
  /** ホットキー設定 */
  hotkeys: HotkeyConfig[];
  /** 言語設定（将来の拡張用） */
  language: string;
  /** クリップ書き出し時のオーバーレイ設定 */
  overlayClip: {
    enabled: boolean;
    showActionName: boolean;
    showActionIndex: boolean;
    showLabels: boolean;
    showQualifier: boolean;
    textTemplate: string; // e.g. "{actionName} #{index} | {labels} | {qualifier}"
  };
  /** コーディングパネルのモード/ツールバー設定 */
  codingPanel?: {
    defaultMode: 'code' | 'label';
    toolbars: Array<{
      id: string;
      label: string;
      mode: 'code' | 'label';
      enabled: boolean;
      plugin?: 'matrix' | 'script' | 'organizer';
    }>;
    actionLinks?: Array<{
      from: string;
      to: string;
      type: 'exclusive' | 'deactivate' | 'activate';
    }>;
  };
}

/**
 * デフォルト設定値
 */
export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  activePresetId: 'default',
  actionPresets: [],
  hotkeys: [
    { id: 'resync-audio', label: '音声同期を再実行', key: 'Command+Shift+S' },
    { id: 'reset-sync', label: '同期をリセット', key: 'Command+Shift+R' },
    { id: 'manual-sync', label: '今の位置で同期', key: 'Command+Shift+M' },
    {
      id: 'toggle-manual-mode',
      label: '手動モード切替',
      key: 'Command+Shift+T',
    },
    { id: 'analyze', label: '分析開始', key: 'Command+Shift+A' },
    { id: 'undo', label: '元に戻す', key: 'Command+Z' },
    { id: 'redo', label: 'やり直す', key: 'Command+Shift+Z' },
    { id: 'skip-forward-small', label: '0.5倍速再生', key: 'Right' },
    { id: 'skip-forward-medium', label: '2倍速再生', key: 'Shift+Right' },
    { id: 'skip-forward-large', label: '4倍速再生', key: 'Command+Right' },
    { id: 'skip-forward-xlarge', label: '6倍速再生', key: 'Option+Right' },
    { id: 'skip-backward-medium', label: '5秒戻し', key: 'Left' },
    { id: 'skip-backward-large', label: '10秒戻し', key: 'Shift+Left' },
    { id: 'play-pause', label: '再生/停止', key: 'Space' },
  ],
  language: 'ja',
  overlayClip: {
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showQualifier: true,
    textTemplate: '{actionName} #{index} | {labels} | {qualifier}',
  },
  codingPanel: {
    defaultMode: 'code',
    toolbars: [
      { id: 'organizer', label: 'オーガナイザー', mode: 'label', enabled: true, plugin: 'organizer' },
    ],
    actionLinks: [],
  },
};
