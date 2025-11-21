/**
 * Sportscode SCTimeline フォーマットの型定義
 *
 * 複数のSCTimelineファイルを分析した結果:
 * - labels配列は空の場合がある
 * - groupフィールドはオプショナル
 * - packagePathは空文字列またはフルパス
 * - currentPlaybackTimeはルートレベルにオプショナルで存在
 */

/**
 * ラベル情報
 * actionType, actionResult などの分類情報を表す
 */
export interface SCLabel {
  /** ラベル名（例: "Won", "Lineout", "Attack 1/2"） */
  name: string;
  /** グループ名（例: "actionResult", "actionType", "Period", "Team"）
   * オプショナル: 存在しない場合もある */
  group?: string;
}

/**
 * タイムライン上の個別イベント（インスタンス）
 */
export interface SCInstance {
  /** 一意識別子（UUID形式） */
  uniqueId: string;
  /** インスタンス番号（同じ行内での連番） */
  instanceNum: number;
  /** 変更回数（編集履歴の管理用） */
  modifyCount: number;
  /** 開始時刻（秒、小数点あり） */
  startTime: number;
  /** 終了時刻（秒、小数点あり） */
  endTime: number;
  /** メモ・備考 */
  notes: string;
  /** 共有フラグ */
  sharing: boolean;
  /** イベントに付与されたラベル配列
   * 空配列の場合もある */
  labels: SCLabel[];
}

/**
 * タイムライン上の行（アクション種類ごとの行）
 */
export interface SCRow {
  /** 行番号 */
  rowNum: number;
  /** 変更回数 */
  modifyCount: number;
  /** 行の名前（例: "Start Period", "Lineout", "Bad", "Good"） */
  name: string;
  /** 一意識別子（UUID形式） */
  uniqueId: string;
  /** 表示色（16進数カラーコード、例: "#E9E9E9", "#3890E0"） */
  color: string;
  /** この行に属するイベント（インスタンス）の配列 */
  instances: SCInstance[];
}

/**
 * タイムライン本体
 */
export interface SCTimelineContent {
  /** パッケージパス（空文字列またはフルパス） */
  packagePath: string;
  /** 一意識別子（UUID形式） */
  uniqueId: string;
  /** 現在の変更回数 */
  currentModifyCount: number;
  /** タイムライン全体に付与されたラベル配列
   * 通常は空配列 */
  labels: SCLabel[];
  /** タイムライン上の行の配列 */
  rows: SCRow[];
}

/**
 * SCTimelineファイルのルート構造
 */
export interface SCTimelineFile {
  /** タイムライン本体 */
  timeline: SCTimelineContent;
  /** 現在の再生時刻（秒、オプショナル） */
  currentPlaybackTime?: number;
}
