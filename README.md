# SporTagLytics

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.7-blue.svg)](https://github.com/Kou-ISK/sportaglytics/releases)

スポーツ映像（特にラグビー）のタグ付け・統計可視化を行うElectronデスクトップアプリケーション。

## 主な機能

- 🎥 **デュアル映像同期再生** - 2つの映像を音声同期で完全同期
- 🏷️ **カスタマイズ可能なタグ付け** - 自由配置のボタンレイアウトとホットキー対応
- 📊 **リアルタイム統計分析** - ポゼッション、モメンタム、クロス集計など
- 🎬 **プレイリスト機能** - フリーズフレーム、簡易描画、クリップ書き出し
- 📈 **ビジュアルタイムライン** - ズーム、範囲選択、ドラッグ編集対応
- 💾 **多形式エクスポート** - JSON/CSV/SCTimeline形式に対応
- 📦 **独自ファイル形式** - `.stpkg`パッケージ、`.stpl`プレイリスト、`.stcw`コードウィンドウ

## スクリーンショット

_Coming soon..._

---

## クイックスタート

### インストール

**macOS (推奨)**

```bash
brew tap Kou-ISK/tap
brew install --cask sportaglytics
```

**その他のプラットフォーム**

[Releases](https://github.com/Kou-ISK/sportaglytics/releases) から最新版をダウンロードしてください。

### 基本的な使い方

1. **パッケージを開く** - 既存のパッケージフォルダを選択
2. **新規作成** - 4ステップウィザードで新規パッケージを作成
3. **映像同期** - `Cmd+Shift+S` で音声同期を実行
4. **タグ付け** - コードパネルのボタンまたはホットキーでイベントを記録
5. **分析** - `Cmd+Shift+A` で統計ダッシュボードを表示

詳細な使い方は [ユーザーガイド](docs/user-guide.md) を参照してください。

---

## ドキュメント

- 📖 [ユーザーガイド](docs/user-guide.md) - 詳細な使い方
- 👨‍💻 [開発者ガイド](docs/development.md) - 開発環境のセットアップと貢献方法
- 📋 [技術仕様書](docs/requirement.md) - 詳細な機能要件
- 🏗️ [アーキテクチャ](docs/system-overview.md) - システム設計と主要コンポーネント
- 🎨 [カスタムファイルアイコン](docs/custom-file-icons.md) - 独自ファイル形式とアイコン実装
- 📝 [CHANGELOG](CHANGELOG.md) - 変更履歴

## 技術スタック

- **フロントエンド**: React 18.3 + TypeScript 5.9
- **デスクトップ**: Electron 31
- **UI**: Material-UI 5
- **映像**: Video.js 8
- **パッケージ管理**: pnpm 9

## 開発

### 必要な環境

- Node.js 18.0.0+
- pnpm 9.0.0+

### セットアップ

```bash
# pnpmのインストール（未インストールの場合）
npm install -g pnpm

# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm run electron:dev
```

詳細は [開発者ガイド](docs/development.md) を参照してください。

## コントリビューション

コントリビューションを歓迎します！詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)

## 謝辞

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Material-UI](https://mui.com/)
- [Video.js](https://videojs.com/)

## トラブルシューティング

- **映像が再生されない**: MP4/MOV & H.264/AAC を推奨。権限/パスを確認。
- **音声同期がずれる**: 両映像に音声があるか確認し、`同期リセット` → `音声同期を再実行`。手動同期/手動モードで微調整可能。
- **タイムラインが反映されない**: `timeline.json` の書き込み権限と残容量を確認。
- **パッケージ読み込みエラー**: `.metadata/config.json` の有無と相対パス変換を確認。

---

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

---

© 2024-2026 Kou-ISK. All rights reserved.
