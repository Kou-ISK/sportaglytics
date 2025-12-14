import type { SCLabel } from './SCTimeline';

/**
 * プレイリストの種類
 * - reference: タイムラインへの参照（元データが変わると反映される）
 * - embedded: 独立したコピー（元データとは独立）
 */
export type PlaylistType = 'reference' | 'embedded';

/**
 * プレイリスト内の個別アイテム
 * TimelineDataを参照しつつ、独自のstart/end時間を持てる
 */
export interface PlaylistItem {
  /** ユニークID (uuid) */
  id: string;
  /** 参照元タイムラインアイテムのID (null = 手動追加 or 埋め込み) */
  timelineItemId: string | null;
  /** アクション名（参照元から複製、編集可能） */
  actionName: string;
  /** 再生開始時間（秒）- 微調整可能 */
  startTime: number;
  /** 再生終了時間（秒）- 微調整可能 */
  endTime: number;
  /** ラベル（参照元から複製） */
  labels?: SCLabel[];
  /** Qualifier（参照元から複製） */
  qualifier?: string;
  /** メモ・コメント */
  note?: string;
  /** 追加日時 (timestamp) */
  addedAt: number;
  /** 動画ソースパス1（埋め込み時に保持）*/
  videoSource?: string;
  /** 動画ソースパス2（埋め込み時に保持、2アングル用）*/
  videoSource2?: string;
}

/**
 * プレイリスト
 */
export interface Playlist {
  /** ユニークID (uuid) */
  id: string;
  /** プレイリスト名 */
  name: string;
  /** 説明 */
  description?: string;
  /** プレイリストの種類（参照/埋め込み） */
  type: PlaylistType;
  /** アイテム一覧（順序維持） */
  items: PlaylistItem[];
  /** 元のムービーパッケージパス（参照用） */
  sourcePackagePath?: string;
  /** 作成日時 (timestamp) */
  createdAt: number;
  /** 更新日時 (timestamp) */
  updatedAt: number;
}

/**
 * プレイリスト全体の状態
 */
export interface PlaylistState {
  /** プレイリスト一覧 */
  playlists: Playlist[];
  /** 現在アクティブなプレイリストID */
  activePlaylistId: string | null;
  /** 現在再生中のアイテムID */
  playingItemId: string | null;
  /** ループ再生モード */
  loopMode: 'none' | 'single' | 'all';
}

/**
 * プレイリストウィンドウへ送信するデータ（メイン→プレイリスト）
 */
export interface PlaylistSyncData {
  /** プレイリスト状態全体 */
  state: PlaylistState;
  /** 現在の動画パス（メイン映像） */
  videoPath: string | null;
  /** 現在の動画パス2（サブ映像） */
  videoPath2: string | null;
  /** 利用可能な動画パス一覧 */
  videoSources: string[];
  /** 現在の再生時間 */
  currentTime: number;
  /** ムービーパッケージパス */
  packagePath?: string;
}

/**
 * メインウィンドウへ送信するコマンド（プレイリスト→メイン）
 */
export type PlaylistCommand =
  | { type: 'seek'; time: number }
  | { type: 'play-item'; itemId: string }
  | { type: 'update-state'; state: PlaylistState }
  | { type: 'add-items'; items: PlaylistItem[] }
  | { type: 'request-sync' }
  | { type: 'save-playlist'; playlist: Playlist; filePath?: string }
  | { type: 'load-playlist'; filePath: string };

/**
 * プレイリストAPI（IElectronAPIに統合）
 */
export interface IPlaylistAPI {
  /** プレイリストウィンドウを開く */
  openWindow: () => Promise<void>;
  /** プレイリストウィンドウを閉じる */
  closeWindow: () => Promise<void>;
  /** プレイリストウィンドウが開いているか確認 */
  isWindowOpen: () => Promise<boolean>;
  /** プレイリストウィンドウへ状態を同期 */
  syncToWindow: (data: PlaylistSyncData) => void;
  /** プレイリストウィンドウからのコマンドを受信 */
  onCommand: (callback: (command: PlaylistCommand) => void) => void;
  /** プレイリストウィンドウからのコマンド受信解除 */
  offCommand: (callback: (command: PlaylistCommand) => void) => void;
  /** プレイリストウィンドウ閉じられた通知を受信 */
  onWindowClosed: (callback: () => void) => void;
  /** プレイリストウィンドウ閉じられた通知受信解除 */
  offWindowClosed: (callback: () => void) => void;

  // プレイリストウィンドウ側専用（サブウィンドウで使用）
  /** 状態同期を受信（プレイリストウィンドウ側） */
  onSync: (callback: (data: PlaylistSyncData) => void) => void;
  /** 状態同期受信解除 */
  offSync: (callback: (data: PlaylistSyncData) => void) => void;
  /** コマンドを送信（プレイリストウィンドウ側からメインへ） */
  sendCommand: (command: PlaylistCommand) => void;

  // ファイル操作
  /** プレイリストを保存（独立ファイル） */
  savePlaylistFile: (
    playlist: Playlist,
    filePath?: string,
  ) => Promise<string | null>;
  /** プレイリストを読み込み */
  loadPlaylistFile: (filePath?: string) => Promise<Playlist | null>;
}

/**
 * 初期プレイリスト状態
 */
export const initialPlaylistState: PlaylistState = {
  playlists: [],
  activePlaylistId: null,
  playingItemId: null,
  loopMode: 'none',
};
