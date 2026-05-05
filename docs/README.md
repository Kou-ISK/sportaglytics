# SporTagLytics Documentation

このディレクトリは SporTagLytics のドキュメント入口です。実装規約の正本はリポジトリルートの `AGENTS.md` です。本ページは、利用者、開発者、AI contributor が必要な情報へ最短で辿れるように整理します。

## Start Here

| 目的                          | 読むもの                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| アプリを使う                  | [ユーザーガイド](user-guide.md)                                                                  |
| 開発環境を作る                | [開発ガイド](development.md)                                                                     |
| 現行アーキテクチャを把握する  | [システム概要](system-overview.md)                                                               |
| ファイル配置を判断する        | [プロジェクト構成](project-structure.md)                                                         |
| 設計判断の背景を見る          | [ADR](adr/README.md)                                                                             |
| ドキュメントを更新する        | [ドキュメント運用ガイド](documentation-guide.md)                                                 |
| AI agent / Copilot で実装する | [AGENTS.md](../AGENTS.md), [.github/copilot-instructions.md](../.github/copilot-instructions.md) |

## User Documentation

- [ユーザーガイド](user-guide.md): パッケージ作成、タグ付け、分析、プレイリスト、エクスポート。
- [Homebrew quickstart](homebrew-quickstart.md): Homebrew Cask での導入。
- [プレイリスト機能](playlist-features.md): プレイリスト画面と関連操作。

## Developer Documentation

- [開発ガイド](development.md): セットアップ、品質ゲート、開発ワークフロー。
- [システム概要](system-overview.md): Feature-First、Electron IPC、shared contracts の現行構造。
- [プロジェクト構成](project-structure.md): ディレクトリ構成と新規ファイルの配置判断。
- [デザインシステム](design-system.md): MUI theme と shared UI の運用。
- [Architecture exceptions](architecture-exceptions.md): `AGENTS.md` からの一時例外台帳。
- [ADR](adr/README.md): 長期的な設計判断。

## Feature / Specification Notes

- [技術仕様書](requirement.md): 機能要件と仕様メモ。
- [音声同期オフセット仕様](audio-sync-offset-specification.md): 音声同期 offset の計算・適用。
- [コードウィンドウ設定](code-window-settings.md): コードウィンドウ設定機能。
- [SCTimeline 実装](sctimeline-implementation.md): SCTimeline 形式対応。
- [カスタムファイルアイコン](custom-file-icons.md): 独自ファイル形式と icon / bundle 設定。
- [Homebrew distribution](homebrew-distribution.md): Homebrew Cask 配布手順。

## AI Contributor Map

AI agent は次の順で参照してください。

1. `AGENTS.md`: MUST / SHOULD / MAY の正本。
2. `.github/copilot-instructions.md`: AI / Copilot 向け入口と品質ゲート。
3. `.github/instructions/*.instructions.md`: 対象ファイル別の差分ルール。
4. [システム概要](system-overview.md): 現行実装のトレース。
5. [プロジェクト構成](project-structure.md): 新規ファイルの配置判断。
6. [ADR](adr/README.md): 変更してはいけない設計判断、変更する場合に更新すべき判断。

設計・ユーザー影響・ドキュメント運用が変わる変更では、[ドキュメント運用ガイド](documentation-guide.md) に従って同期してください。
