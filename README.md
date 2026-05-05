# SporTagLytics

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](https://github.com/Kou-ISK/sportaglytics/releases)

スポーツ映像のタグ付け、同期再生、統計可視化、プレイリスト作成を行う Electron デスクトップアプリケーションです。現在の主な利用想定はラグビー分析ですが、タイムラインとラベルを中心にした設計のため、他競技への応用も見込んでいます。

## 主な機能

- **デュアル映像同期再生**: 2 つの映像を音声同期で再生
- **カスタマイズ可能なタグ付け**: 自由配置のボタンレイアウトとホットキー
- **リアルタイム統計分析**: ダッシュボード、モメンタム、クロス集計
- **AI 分析機能**: ローカル LLM による映像分析と推奨クリップ生成
- **プレイリスト機能**: フリーズフレーム、簡易描画、クリップ書き出し
- **ビジュアルタイムライン**: ズーム、範囲選択、ドラッグ編集
- **多形式エクスポート**: JSON / CSV / SCTimeline
- **独自ファイル形式**: `.stpkg` パッケージ、`.stpl` プレイリスト、`.stcw` コードウィンドウ

## スクリーンショット

_Coming soon..._

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

## ドキュメント

- [ドキュメント索引](docs/README.md): 利用者、開発者、AI contributor 向けの入口
- [ユーザーガイド](docs/user-guide.md): 詳細な使い方
- [開発ガイド](docs/development.md): 開発環境、ワークフロー、品質ゲート
- [システム概要](docs/system-overview.md): 現行アーキテクチャの要約
- [プロジェクト構成](docs/project-structure.md): ディレクトリ構成と新規ファイルの配置判断
- [ADR](docs/adr/README.md): 長期的な設計判断の記録
- [ドキュメント運用ガイド](docs/documentation-guide.md): docs 更新方針と同期ルール
- [CHANGELOG](CHANGELOG.md): 変更履歴

## 技術スタック

- **フロントエンド**: React 19.2 + TypeScript 5.4
- **デスクトップ**: Electron 40
- **UI**: Material-UI 7
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

# Electronアプリを開発モードで起動
pnpm run electron:dev
```

品質ゲート:

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

詳細は [開発ガイド](docs/development.md) を参照してください。

## AI contributor 向け入口

このリポジトリでは `AGENTS.md` を AI 実装規約の正本としています。AI agent / Copilot / human contributor は、実装前に以下を確認してください。

- [AGENTS.md](AGENTS.md): アーキテクチャ、TypeScript、React、Electron セキュリティの必須規約
- [.github/copilot-instructions.md](.github/copilot-instructions.md): Copilot 向けの適用順序
- [ドキュメント索引](docs/README.md): 変更対象に応じた参照先
- [プロジェクト構成](docs/project-structure.md): 新規ファイルの配置判断
- [ADR](docs/adr/README.md): 既存の設計判断

## コントリビューション

コントリビューションの流れは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。セキュリティ問題は public issue ではなく [SECURITY.md](SECURITY.md) の手順で報告してください。

## ライセンス

[MIT License](LICENSE) です。

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
