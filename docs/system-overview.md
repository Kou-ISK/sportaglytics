# SporTagLytics System Overview

最新仕様のサマリと主要コンポーネント/データ構造の整理。実装を追う際の足がかりにしてください。

## 主要フロー

- **パッケージ管理**: `VideoPathSelector` で新規作成/既存読み込み。`.metadata/config.json` にチーム名・映像パス・syncData を保存、`timeline.json` にイベントを自動保存。
- **映像再生/同期**: `useSyncActions` が音声同期・手動同期・リセットを担い、`useSyncMenuHandlers` でメニューと連携。同期結果は `syncData` として保持し、再生時にオフセット適用。
- **タグ付け**: `EnhancedCodePanel` でアクション+ラベルを選択し、`addTimelineData` 経由で `timeline` に反映。ホットキーは `useHotkeyBindings` 経由で登録。
- **タイムライン編集**: `VisualTimeline` が描画。ズーム/幅計算は `useTimelineViewport`、選択やコンテキストメニュー/編集ハンドラは `useTimelineInteractions`。編集ダイアログの入力管理は `useTimelineEditDraft`、バリデーションは `useTimelineValidation`。
- **分析ダッシュボード**: `StatsModalView`。共通カードレイアウトは `StatsCard`、ヘッダーは `StatsModalHeader`。Breakdown は `useActionBreakdown`、Matrix 軸設定は `useMatrixAxes`、フィルタは `useMatrixFilters`。
- **設定**: `SettingsPage` は `SettingsTabs`/`SettingsHeader`/`UnsavedChangesDialog` に分離。未保存チェックは `useUnsavedTabSwitch`。
- **プレイリスト**: `PlaylistContext` でプレイリスト管理、専用ウィンドウ（`PlaylistWindowApp`）で連続/ループ再生、フリーズフレーム、簡易描画、メモ編集に対応。Electron の IPC 経由でメイン↔プレイリストウィンドウ間で双方向通信。

## データ構造

- **TimelineData** (`src/types/TimelineData.ts`): `id`, `actionName`, `startTime`, `endTime`, `memo`, `labels`(SCLabel[])、後方互換フィールド `actionType/actionResult`。
- **パッケージ構成**: `.metadata/config.json`（チーム名・映像パス・syncData）、`timeline.json`（イベント）、`videos/` 配下に映像。
- **SyncData** (`src/types/VideoSync.ts`): `syncOffset`, `isAnalyzed`, `confidenceScore`。手動同期でも `isAnalyzed:true` で保存。

## ホットキー/操作

- 再生系: Space 再生/停止、Right/Shift+Right/Cmd+Right/Option+Right で可変速、Left/Shift+Left で巻き戻し。
- 分析表示: Cmd/Ctrl+Shift+A。
- 同期: Cmd/Ctrl+Shift+S（再同期）、Cmd/Ctrl+Shift+R（リセット）、Cmd/Ctrl+Shift+M（手動同期）、Cmd/Ctrl+Shift+T（手動モード切替）。
- Undo/Redo: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z。
- アクションホットキー: プリセットで設定（1チーム目はキー単体、2チーム目は Shift+キー）。

## 開発予定 / UX強化案

- **ラベルプリセット＋数字キー即付与**: ラベルプリセットを数字/Fキーに割当て、モード切替なしで即付与できるようにする。`useHotkeyBindings` にプリセット専用のキー設定と `VisualTimeline` のラベル適用ハンドラを接続。プリセットは設定画面/ローカルストレージに保存。
- **選択中アクションジャンプ (次/前)**: 選択中アクションインスタンスの次/前インスタンスへショートカットで移動
  （例: ⌥Tab/⌥⇧Tab）。
- **選択HUD（合計/平均時間）**: 選択中インスタンスの合計時間・平均時間・件数をツールバーに表示。`VisualTimeline` で選択集合から計算して表示。
- **クリップ書き出し高度化**: プレイリスト統合のクリップ書き出し機能をメインタイムラインにも展開。Matrix/選択インスタンスをまとめて映像クリップ出力し、オプションで画面下部にアクション名・ラベル・メモをオーバーレイ表示。

## 既存コンポーネント/フックの再利用指針

- **同期系**: `useSyncActions` を使用し、通知は `onSyncInfo/onSyncWarning/onSyncError` で受け取る。直接 console に依存しない。
- **タイムライン**: 画面ロジックは `useTimelineInteractions`、ビュー計算は `useTimelineViewport`、編集フォームは `useTimelineEditDraft`/`useTimelineValidation` を優先。
- **分析UI**: カードは `StatsCard`、ヘッダーは `StatsModalHeader` を再利用。Breakdown データ整形は `useActionBreakdown`、Matrix 軸は `useMatrixAxes`、フィルタは `useMatrixFilters`。
- **設定画面**: タブ切替は `useUnsavedTabSwitch`、レイアウトは `SettingsHeader`/`SettingsTabs` を利用。

## 動作確認の目安

- `pnpm run build` で型/ESLintエラーなし。
- タイムライン編集ダイアログで不正値を入れると保存が無効になる（バリデーション表示）。
- 音声同期実行で通知/ログが `onSyncInfo/onSyncWarning/onSyncError` 経由で出ること。
- Stats モーダルで各タブが表示され、Matrix フィルタ/軸変更が反映されること。
