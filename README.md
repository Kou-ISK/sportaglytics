# SporTagLytics

スポーツ映像（ラグビー想定）のタグ付け・統計可視化を行うElectronデスクトップアプリ。

- 2映像の同期再生（自動/手動オフセット、手動モードで個別シーク）
- ラベルグループ付きのタグ付け（アクションプリセットとホットキーをカスタマイズ可能）
- ビジュアルタイムライン編集（ズーム、コンテキストメニュー、インライン編集）
- 統計ダッシュボード（ポゼッション/結果/種別/モメンタム/クロス集計、映像ジャンプ対応）
- タイムラインのエクスポート/インポート（JSON/CSV/Sportscode SCTimeline）
- 設定画面でテーマ・プリセット・ホットキーを管理

---

## 技術スタック

- React 18.3 + TypeScript 5.9
- Electron 31
- Material UI 5
- Video.js 8
- パッケージマネージャー: pnpm 9

---

## インストール

### macOS (Homebrew)

```bash
brew tap Kou-ISK/tap
brew install --cask sportaglytics
brew upgrade --cask sportaglytics
```

Gatekeeper でブロックされた場合は以下を実行してから起動:

```bash
sudo xattr -cr /Applications/SporTagLytics.app
```

### 手動インストール

Releases から各プラットフォームのバイナリを取得して実行。

---

## 開発者向けセットアップ

```bash
npm install -g pnpm           # 未インストールの場合
pnpm install

# 開発モード（React + Electron）
pnpm run electron:dev

# 本番ビルド + 起動
pnpm run electron:start

# 配布ビルド
pnpm run electron:build

# 型チェック
pnpm exec tsc --noEmit
pnpm exec tsc -p electron --noEmit
```

---

## 使い方

### 1. 初回起動
- オンボーディングチュートリアルが自動表示されます（スキップ可）。
- ウェルカム画面でドラッグ&ドロップ、またはボタンからパッケージを選択します。

### 2. パッケージを開く
- 「既存パッケージを開く」またはフォルダをドラッグ&ドロップ。
- `.metadata/config.json` を読み込み、映像パス/チーム名/同期情報を復元します。
- 2映像で同期情報が無い場合は自動で音声同期を実行し、結果を保存します。

### 3. 新規パッケージ作成
4ステップウィザードで作成（基本情報 → 保存先 → 映像選択 → 確認）。
- 寄り映像は必須、引き映像は任意。
- 作成時点では音声同期は自動実行しません（必要に応じて後述の「音声同期」を使用）。
- 生成物: `.metadata/config.json`, `timeline.json`, `videos/`（映像はコピー＆リネーム）。

### 4. 音声同期と同期モード
- メニュー「映像」またはホットキーで操作  
  - `Cmd/Ctrl + Shift + S`: 音声同期を再実行（進捗バー付き）  
  - `Cmd/Ctrl + Shift + R`: 同期リセット（オフセット0）  
  - `Cmd/Ctrl + Shift + M`: 現在位置で手動同期（2映像の時間差をその場で採用）  
  - `Cmd/Ctrl + Shift + T`: 手動モード切替（オン時は各プレイヤーの個別シークを許可）
- オフセットは `.metadata/config.json` に保存され、再生時に自動適用されます。

### 5. タグ付け（コードパネル）
- チームごとにアクションボタンを表示。選択すると録画開始、同じボタンで録画終了しタイムラインへ追加。
- アクションはプリセットから構成（デフォルトはラグビー）。`groups` 構造で複数ラベルグループを持てます（従来の `types/results` も後方互換で表示）。
- ラベルを選択した状態で記録すると `labels` 配列として保存（`actionType/actionResult` は非推奨フィールドとして自動補完）。
- アクションごとにホットキーを設定可能（Shift+キーで2チーム目を起動）。

### 6. タイムライン編集
- ビジュアルタイムラインでイベントを表示/編集。  
  - クリックでジャンプ、Cmd/Ctrl+ホイールでズーム。  
  - コンテキストメニューから編集/削除/ジャンプ。  
  - Enter で編集ダイアログ、Delete/Backspace で削除。  
  - 編集ダイアログで時刻・メモ・ラベルをまとめて更新。  
- 変更は `timeline.json` に自動保存されます（数百 ms デバウンス）。

### 7. 統計ダッシュボード（分析 → `Cmd/Ctrl + Shift + A`）
- **ポゼッション**: 時間集計（円グラフ）
- **アクション結果/種別**: アクション別に結果/種別を集計（円グラフ）
- **モメンタム**: ポゼッションの流れを棒グラフ表示（色分け: Try/Positive/Negative/Neutral）
- **クロス集計**: 任意の行/列軸（チーム・アクション・ラベルグループ/all_labels）でヒートマップ表示  
  - チーム/アクション/ラベルでフィルタ  
  - セルをクリックすると該当イベントへジャンプ

### 8. タイムラインのエクスポート/インポート
- メニュー「タイムライン」から操作。  
  - JSON: アプリ内部形式  
  - CSV: YouTube用に `時刻, 終了時刻, アクション名, タイプ, 結果, 備考` を出力  
  - SCTimeline: Sportscode 互換JSON（行/インスタンス形式）  
- インポート時は JSON を優先解析し、失敗時に SCTimeline も自動判定します。

### 9. 設定
- メニュー「設定」 (`Cmd/Ctrl + ,`) で開く。  
  - 一般: テーマ（ライト/ダーク/システム）  
  - アクションプリセット: 追加/編集/削除、アクションごとのラベルグループ・ホットキー設定、プリセットのインポート/エクスポート  
  - ホットキー: 再生・同期・分析・Undo/Redo などのキーバインド編集  
- 変更はローカル設定ファイルに保存され、アプリ全体に反映されます。

---

## データ構造

### パッケージ
```
PackageName/
├── .metadata/
│   ├── config.json          # 映像パス（相対）、チーム名、アクションリスト、syncData など
│   └── sync.json (未使用)   # 互換性維持用
├── timeline.json            # タイムラインデータ（自動保存）
└── videos/
    ├── PackageName 寄り.mp4
    └── PackageName 引き.mp4 (任意)
```

### タイムライン
```ts
type TimelineData = {
  id: string;               // ULID
  actionName: string;       // 例: "TeamA Lineout"
  startTime: number;        // 秒
  endTime: number;          // 秒
  qualifier: string;        // メモ
  labels?: { name: string; group?: string }[]; // ラベルグループ構造
  // 非推奨: 後方互換フィールド（labelsが無い場合に自動補完）
  actionResult?: string;
  actionType?: string;
};
```

---

## デフォルトホットキー

| キー                         | 機能                     |
| ---------------------------- | ------------------------ |
| `Space`                      | 再生/停止                |
| `Right` / `Shift+Right`      | 0.5倍速 / 2倍速再生（キーアップで1倍に戻る） |
| `Cmd/Ctrl+Right` / `Option+Right` | 4倍速 / 6倍速再生 |
| `Left` / `Shift+Left`        | 5秒戻し / 10秒戻し       |
| `Cmd/Ctrl+Shift+S`           | 音声同期を再実行         |
| `Cmd/Ctrl+Shift+R`           | 同期をリセット           |
| `Cmd/Ctrl+Shift+M`           | 今の位置で同期（手動）   |
| `Cmd/Ctrl+Shift+T`           | 手動モード切替           |
| `Cmd/Ctrl+Shift+A`           | 統計ダッシュボード       |
| `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` | Undo / Redo       |
| アクションプリセットで設定   | アクション開始/終了（Shift+キーで2チーム目） |

コントローラー右上の「?」アイコンからショートカットガイドを開けます。

---

## トラブルシューティング

- 映像が再生されない: MP4/MOV & H.264/AAC を推奨。権限/パスを確認。
- 音声同期がずれる: 両映像に音声があるか確認し、`同期リセット` → `音声同期を再実行`。手動同期/手動モードで微調整可能。
- タイムラインが反映されない: `timeline.json` の書き込み権限と残容量を確認。
- パッケージ読み込みエラー: `.metadata/config.json` の有無と相対パス変換を確認。

---

## ライセンス

MIT
