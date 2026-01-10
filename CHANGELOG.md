# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## バージョニング方針

- **MAJOR**: 破壊的変更（データフォーマット変更、主要機能の大幅変更）
- **MINOR**: 新機能追加（後方互換性あり）
- **PATCH**: バグ修正、パフォーマンス改善

詳細は[ROADMAP.md](ROADMAP.md#バージョニング方針)を参照してください。

---

## [Unreleased]

### 計画中

- テスト基盤の構築（ユニットテスト・E2Eテスト）
- パフォーマンス最適化（大量データ対応）
- ラベルプリセット + 数字キー即付与機能
- Storybook導入
- Windows/Linux対応

詳細は[ROADMAP.md](ROADMAP.md)を参照してください。

---

## [0.2.2] - 2025-11-06 (現行バージョン)

### 🚀 主要機能

#### 映像再生・同期

- デュアル映像同期再生（プライマリ/セカンダリ）
- 音声波形解析による自動同期（FFT相互相関分析）
- 手動同期機能（オフセット調整ダイアログ、現在位置で同期）
- 手動モード（個別シークバー操作）
- 共通シークバーによる統一制御
- 可変速度再生（0.5x / 1x / 2x / 4x / 6x）

#### タグ付け

- リアルタイムタグ付け（チーム別アクション記録）
- ラベルグループ構造対応（`groups`, `labels`配列）
- カスタムコードウィンドウ（自由配置レイアウト、ボタンリンク機能）
- ホットキーカスタマイズ（1チーム目: キー単体、2チーム目: Shift+キー）
- 同時複数アクション記録

#### タイムライン編集

- ビジュアルタイムライン（色分け、ズーム、範囲選択）
- インライン編集（時刻・メモ・ラベル）
- コンテキストメニュー（編集/削除/ジャンプ/重複/プレイリスト追加）
- Undo/Redo（最大50件）
- バリデーション（時間範囲チェック、重複検出）
- 検索・フィルタリング

#### 統計分析

- ポゼッション分析（円グラフ）
- アクション結果/種別分析（円グラフ）
- モメンタムチャート（棒グラフ、色分け）
- クロス集計（ヒートマップ、任意軸、ドリルダウン）
- 映像ジャンプ機能

#### プレイリスト

- 複数プレイリスト管理
- 専用ウィンドウ（連続/ループ再生）
- フリーズフレーム
- 簡易描画機能（矢印/円/矩形/テキスト）
- メモ編集

#### エクスポート/インポート

- JSON形式（完全情報保持）
- CSV形式（Excel互換）
- SCTimeline形式（Sportscode互換）
- クリップ書き出し（FFmpeg、オーバーレイ対応）

#### パッケージ管理

- 4ステップウィザード（基本情報→保存先→映像選択→確認）
- 映像ファイルコピー＆リネーム
- `.metadata/config.json`（チーム名、アングル情報、syncData）
- 相対パス自動変換
- 最近開いたパッケージ履歴

#### 設定

- テーマ切替（Light/Dark/System）
- ホットキーカスタマイズ（衝突検出、デフォルトリセット）
- コードウィンドウ設定（レイアウト、ボタン配置、リンク、エクスポート/インポート）
- クリップオーバーレイ設定
- 未保存変更検出

#### UX機能

- オンボーディングチュートリアル
- ショートカットガイド
- クイックヘルプFAB
- 統一エラーハンドリング（Snackbar通知）

### 🛠 技術スタック

- **React**: 18.3.1
- **TypeScript**: 5.9.3（strict mode）
- **Electron**: 31.6.0
- **Material-UI**: 5.18.0
- **Video.js**: 8.23.4
- **pnpm**: 9.1.0+

### 🔒 Breaking Changes（pnpm移行）

**コマンド変更**:

```bash
# 旧: yarn electron:dev
# 新: pnpm run electron:dev
```

**必須要件**:

- Node.js 18.0.0以上
- pnpm 9.0.0以上（グローバルインストール: `npm install -g pnpm`）

**ファイル構造**:

- `yarn.lock` → `pnpm-lock.yaml`
- `.npmrc`追加

### 📚 ドキュメント

- README.md全面更新（pnpm対応、詳細な使い方）
- CONTRIBUTING.md追加（開発ガイドライン）
- CHANGELOG.md追加（本ファイル）
- `.github/copilot-instructions.md`更新（Electron 31対応）

### 🐛 主要バグ修正

- 2つ目の映像が表示されなくなる問題（プレイヤー健全性チェック強化）
- 共通シークバーのNaN表示問題（多層防護、フォールバック機能）
- `web-vitals` v4 API変更対応
- Electron 31での型エラー修正
- TypeScript 5.9コンパイルエラー解消

---

## Earlier Versions

詳細な履歴はGitコミットログを参照してください。
