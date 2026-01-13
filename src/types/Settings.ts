import { TEAM_PLACEHOLDERS } from '../utils/teamPlaceholder';

/** デフォルトコードウィンドウのレイアウトを生成 */
const createDefaultCodeWindowLayout = (): CodeWindowLayout => {
  // 横2列・8行で均等幅/余白、右パネル内で縮小されないサイズ
  const canvasWidth = 360;
  const canvasHeight = 420;
  const columnWidth = 160;
  const rowHeight = 40;
  const leftX = 10;
  const gapX = 20;
  const rightX = leftX + columnWidth + gapX; // 10 + 160 + 20 = 190
  const rows = [
    { key: 'ポゼッション', y: 10 },
    { key: 'スクラム', y: 55 },
    { key: 'ラインアウト', y: 100 },
    { key: 'キックオフ', y: 145 },
    { key: 'PK', y: 190 },
    { key: 'FK', y: 235 },
    { key: 'キック', y: 280 },
    { key: 'ショット', y: 325 },
    { key: 'トライ', y: 370 },
  ];

  const makeButtons = (placeholder: string, x: number, color: string) =>
    rows.map((row, idx) => ({
      id: `${placeholder}-${idx}`,
      type: 'action' as const,
      name: `${placeholder} ${row.key}`,
      x,
      y: row.y,
      width: columnWidth,
      height: rowHeight,
      team:
        placeholder === TEAM_PLACEHOLDERS.TEAM1
          ? ('team1' as const)
          : ('team2' as const),
      color,
      textColor: '#ffffff',
      borderRadius: 8,
      fontSize: 14,
    }));

  const team1Buttons = makeButtons(TEAM_PLACEHOLDERS.TEAM1, leftX, '#4B7BEC');
  const team2Buttons = makeButtons(TEAM_PLACEHOLDERS.TEAM2, rightX, '#E74C3C');

  return {
    id: 'default',
    name: 'デフォルト',
    canvasWidth,
    canvasHeight,
    buttons: [...team1Buttons, ...team2Buttons],
    buttonLinks: [],
    splitByTeam: true,
    team1Area: {
      x: 0,
      y: 0,
      width: canvasWidth / 2,
      height: canvasHeight,
    },
    team2Area: {
      x: canvasWidth / 2,
      y: 0,
      width: canvasWidth / 2,
      height: canvasHeight,
    },
  };
};

export const normalizeCodingPanelLayouts = (
  panel: NonNullable<AppSettings['codingPanel']>,
): NonNullable<AppSettings['codingPanel']> => {
  const defaultLayout = createDefaultCodeWindowLayout();
  const existing = panel as Partial<
    NonNullable<AppSettings['codingPanel']> & {
      layouts?: CodeWindowLayout[];
      activeLayoutId?: string;
    }
  >;
  const codeWindows = Array.isArray(existing.codeWindows)
    ? [...existing.codeWindows]
    : Array.isArray(existing.layouts)
      ? [...existing.layouts]
      : [];
  const idx = codeWindows.findIndex((l) => l.id === defaultLayout.id);
  const shouldReplace =
    idx === -1 ||
    codeWindows[idx].canvasWidth !== defaultLayout.canvasWidth ||
    codeWindows[idx].canvasHeight !== defaultLayout.canvasHeight ||
    (codeWindows[idx].buttons?.length ?? 0) !== defaultLayout.buttons.length;

  if (idx === -1) {
    codeWindows.unshift(defaultLayout);
  } else if (shouldReplace) {
    codeWindows[idx] = defaultLayout;
  }

  const activeCodeWindowId =
    existing.activeCodeWindowId ?? existing.activeLayoutId ?? defaultLayout.id;

  return {
    ...panel,
    codeWindows,
    activeCodeWindowId,
  };
};

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
 * コードウィンドウのボタン配置設定
 */
export interface CodeWindowButton {
  /** ボタンの一意なID */
  id: string;
  /** ボタンの種類 */
  type: 'action' | 'label';
  /** アクション名またはラベルグループ名 */
  name: string;
  /** ラベルボタンの場合のラベル値 */
  labelValue?: string;
  /** X座標（ピクセル） */
  x: number;
  /** Y座標（ピクセル） */
  y: number;
  /** 幅（ピクセル） */
  width: number;
  /** 高さ（ピクセル） */
  height: number;
  /** ボタンの背景色 */
  color?: string;
  /** ボタンのテキスト色 */
  textColor?: string;
  /** テキスト配置 */
  textAlign?: 'left' | 'center' | 'right';
  /** 角丸（ピクセル） */
  borderRadius?: number;
  /** ホットキー（例: "a", "1", "Shift+B"） */
  hotkey?: string;
  /** このボタンが属するチーム（'team1', 'team2', 'shared'） */
  team?: 'team1' | 'team2' | 'shared';
  /** グループID（同じIDのボタンをグループ化） */
  groupId?: string;
  /** テキストサイズ(px) */
  fontSize?: number;
}

/**
 * ボタン間のリンク設定
 */
export interface ButtonLink {
  /** リンクの一意なID */
  id: string;
  /** リンク元のボタンID */
  fromButtonId: string;
  /** リンク先のボタンID */
  toButtonId: string;
  /** リンクの種類 */
  type: 'exclusive' | 'deactivate' | 'activate' | 'sequence';
}

/**
 * アクションリンク設定（後方互換性のため残す）
 */
export interface ActionLink {
  /** リンクの一意なID */
  id: string;
  /** リンク元のアクション/ラベル */
  from: string;
  /** リンク先のアクション/ラベル */
  to: string;
  /** リンクの種類 */
  type: 'exclusive' | 'deactivate' | 'activate';
  /** リンクの説明 */
  description?: string;
}

/**
 * コードウィンドウレイアウト設定
 */
export interface CodeWindowLayout {
  /** レイアウトの一意なID */
  id: string;
  /** レイアウト名 */
  name: string;
  /** キャンバス幅（ピクセル） */
  canvasWidth: number;
  /** キャンバス高さ（ピクセル） */
  canvasHeight: number;
  /** ボタン配置 */
  buttons: CodeWindowButton[];
  /** ボタン間のリンク */
  buttonLinks?: ButtonLink[];
  /** チーム別に分離表示するか */
  splitByTeam?: boolean;
  /** チーム1の表示領域 */
  team1Area?: TeamArea;
  /** チーム2の表示領域 */
  team2Area?: TeamArea;
}

/**
 * チームエリアの定義
 */
export interface TeamArea {
  /** X座標（ピクセル） */
  x: number;
  /** Y座標（ピクセル） */
  y: number;
  /** 幅（ピクセル） */
  width: number;
  /** 高さ（ピクセル） */
  height: number;
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
    showMemo: boolean;
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
    actionLinks?: ActionLink[];
    /** コードウィンドウ設定 */
    codeWindows?: CodeWindowLayout[];
    /** アクティブなコードウィンドウID */
    activeCodeWindowId?: string;
  };
}

/**
 * デフォルト設定値
 */
export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
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
    showMemo: true,
  },
  codingPanel: {
    defaultMode: 'code',
    toolbars: [
      {
        id: 'matrix',
        label: 'マトリクス',
        mode: 'code',
        enabled: true,
        plugin: 'matrix',
      },
      {
        id: 'script',
        label: 'スクリプト実行',
        mode: 'code',
        enabled: true,
        plugin: 'script',
      },
      {
        id: 'organizer',
        label: 'オーガナイザー',
        mode: 'label',
        enabled: true,
        plugin: 'organizer',
      },
    ],
    actionLinks: [],
    codeWindows: [createDefaultCodeWindowLayout()],
    activeCodeWindowId: 'default',
  },
};
