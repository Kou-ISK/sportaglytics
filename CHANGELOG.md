# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### � Fixed

- macOSコード署名時のentitlementsファイル読み込みエラーを修正
  - entitlementsファイルを`public/`ディレクトリに配置（electron-builderのbuildResourcesと一致）
  - `.gitignore`の無効な除外ルールを削除

### �🚀 Added

#### CI/CDとリリース自動化

- GitHub Actionsによる自動ビルドワークフローを追加
  - macOS (DMG)、Windows (EXE)、Linux (AppImage) の自動ビルド
  - タグプッシュ時の自動リリース作成
  - 手動ビルドトリガーのサポート
- Homebrew Cask対応のための設定を追加
  - 予測可能なアーティファクト名の設定
  - Caskテンプレートとドキュメント (`.github/HOMEBREW.md`)
- リリース手順のドキュメント追加 (`.github/RELEASE.md`)

#### 設定画面の機能強化

- 未保存変更の検出と確認ダイアログを実装
  - テーマ設定変更時の保存確認
  - ホットキー設定変更時の保存確認
  - タブ切り替え時・ダイアログ閉じる時の警告表示

### 🔧 Changed

- `electron-builder.json`にアーティファクト名の設定を追加
- READMEにインストール方法のセクションを追加

## [3.0.0] - 2025-11-06

### 🚀 Major Updates

#### パッケージマネージャーの移行

- **BREAKING**: `yarn` から `pnpm` に移行
- より高速で効率的な依存関係管理
- 厳密な依存関係の解決によるバグの予防

#### 主要な依存関係のアップデート

- **React**: 18.2.0 → 18.3.1
- **TypeScript**: 4.9.5 → 5.9.3
- **Electron**: 25.4.0 → 31.7.7
- **Material-UI**: 5.14.3 → 5.18.0
- **Video.js**: 8.3.0 → 8.23.4

### ✨ Added

- `.npmrc` 設定ファイルの追加（pnpm互換性設定）
- `package.json` に `packageManager` と `engines` フィールドを追加
- TypeScript 5.9対応の型定義改善
- Electron 31対応のグローバルショートカット実装

### 🔧 Changed

#### Electron関連

- `electron-localshortcut` を削除し、Electronネイティブの `globalShortcut` に移行
- `BrowserWindow` の型アサーションを追加（Electron 31対応）
- メインプロセスとプリロードスクリプトの型安全性を向上

#### TypeScript設定

- `tsconfig.json`: `moduleResolution` を `"bundler"` に変更（React 18.3最適化）
- `electron/tsconfig.json`: Node.js型定義を明示的に追加
- `target` を `ES2020` に更新

#### コード品質

- 未使用のインポートと変数を削除
- ESLint警告の解消
- 型安全性の向上

#### ビルドシステム

- すべてのスクリプトを `yarn` から `pnpm` に変更
- ビルドプロセスの最適化

### 🐛 Fixed

- `web-vitals` v4 API変更に対応（`getCLS` → `onCLS` など）
- Electron 31での `webContents` アクセスの型エラー修正
- TypeScript 5.9でのコンパイルエラー解消
- プリロードスクリプトの型安全性向上

### 🔒 Breaking Changes

1. **コマンドの変更**:

   ```bash
   # 旧コマンド
   yarn electron:dev
   yarn electron:start
   yarn electron:build

   # 新コマンド
   pnpm run electron:dev
   pnpm run electron:start
   pnpm run electron:build
   ```

2. **必須要件**:
   - Node.js 18.0.0 以上が必須
   - pnpm 9.0.0 以上が必須
   - グローバルに pnpm のインストールが必要: `npm install -g pnpm`

3. **ファイル構造**:
   - `yarn.lock` → `pnpm-lock.yaml`
   - `.npmrc` ファイルが新規追加

### 📚 Documentation

- README.md を全面的に更新
  - セットアップ手順を pnpm ベースに変更
  - 技術スタック情報を明記
  - バージョン履歴セクションを追加
- `.github/copilot-instructions.md` を更新
  - 技術スタック情報を追加
  - Electron 31 対応の注意事項を追加
  - コマンドを pnpm に更新
- CHANGELOG.md を新規作成

### 🔄 Migration Guide

既存プロジェクトからの移行手順:

```bash
# 1. pnpm のインストール
npm install -g pnpm

# 2. 既存の依存関係を削除
rm -rf node_modules yarn.lock package-lock.json

# 3. pnpm で依存関係をインストール
pnpm install

# 4. 型チェック
pnpm exec tsc --noEmit
pnpm exec tsc -p electron --noEmit

# 5. アプリケーションを起動
pnpm run electron:dev
```

---

## [2.2.0] - 2025年

### 🐛 Fixed - 2つ目の映像が表示されなくなる問題

#### 問題

シーク操作中に2つ目の映像が表示されなくなる、または完全に消失する問題が発生していました。

#### 原因

- プレイヤーの頻繁な再初期化による不安定化
- 不適切なVideo.js状態管理
- 過度なシーク処理
- エラーハンドリング不足

#### 修正内容

**SyncedVideoPlayer.tsx**:

- 強制更新の最小化（初回同期時のみ）
- プレイヤー健全性チェック強化
- シーク閾値を2.0秒に調整
- 詳細ログ追加
- 非同期シーク処理の実装
- 待機時間を500msに延長

**SingleVideoPlayer.tsx**:

- プレイヤー初期化の改善
- 破棄処理の強化（`isDisposed()` チェック）
- メタデータ処理の改善
- 状態確認の厳密化
- シーク処理の最適化（1.5秒閾値）
- ソース変更の安全性向上
- Promiseベースの再生制御

---

## [2.1.0] - 2025年

### 🐛 Fixed - 共通シークバーのNaN表示問題

#### 問題

共通シークバーで「NaN」が表示され、操作ができない問題が発生していました。

#### 原因

- Video.js プレイヤーの初期化前の値取得
- メタデータ読み込み前での処理
- NaN値に対する不十分なチェック

#### 修正内容

- Video.js の `ready()` と `loadedmetadata` イベントの適切な活用
- 厳密な型チェック（`typeof`, `!isNaN`, 範囲検証）の実装
- フォールバック機能の追加
- 多層防護（入力→表示→操作）
- デバッグログの強化

---

## Earlier Versions

詳細な履歴は Git コミットログを参照してください。
