# Documentation Guide

このガイドは SporTagLytics のドキュメント運用ルールです。目的は、public OSS として読みやすく、AI contributor が正しい文脈を取得しやすい状態を保つことです。

## Source of Truth

| 種別                         | 正本                                     |
| ---------------------------- | ---------------------------------------- |
| AI 実装規約                  | `AGENTS.md`                              |
| Copilot 適用順序             | `.github/copilot-instructions.md`        |
| ファイル種別ごとの差分ルール | `.github/instructions/*.instructions.md` |
| 現行アーキテクチャ要約       | `docs/system-overview.md`                |
| ディレクトリ構成と配置判断   | `docs/project-structure.md`              |
| 長期的な設計判断             | `docs/adr/`                              |
| 一時的な規約例外             | `docs/architecture-exceptions.md`        |
| 利用者向け操作説明           | `docs/user-guide.md`                     |
| 開発者向け手順               | `docs/development.md`                    |

同じ規約本文を複数ファイルへ重複記載しないでください。別ドキュメントからは正本へリンクします。

## When to Update Docs

次の場合はドキュメント更新を必須とします。

- ユーザーから見える操作、設定、保存形式、エクスポート形式が変わる。
- アーキテクチャ境界、IPC、preload、型契約、保存モデルが変わる。
- ディレクトリ構成、配置ルール、新規ファイルの置き場所が変わる。
- `AGENTS.md` の MUST / SHOULD / MAY に影響する。
- 新しい例外を一時的に認める。
- 既存ドキュメントと実装の差分を見つけた。

コードの内部リネームだけで利用者・設計判断・開発手順に影響しない場合、ドキュメント更新は不要です。

## ADR Policy

ADR は Architecture Decision Record です。次の条件を満たす場合に追加または更新します。

- 複数の妥当な選択肢があり、長期的な保守に影響する。
- feature boundary、IPC、データモデル、保存互換、配布、セキュリティに関わる。
- 後続の実装者や AI agent が背景を知らないと誤った変更をしやすい。

ADR は `docs/adr/NNNN-short-title.md` に置き、以下の見出しを使います。

- Status
- Date
- Context
- Decision
- Consequences

Status は `Proposed`, `Accepted`, `Deprecated`, `Superseded` のいずれかを使います。置き換えた ADR は削除せず、superseded 関係を明記します。

## Writing Style

- 既存の主要 docs に合わせ、日本語中心で記述する。
- コマンド、ファイルパス、型名、API 名は code span にする。
- 規約は `MUST` / `SHOULD` / `MAY` を使い、強度を曖昧にしない。
- 実装詳細より、なぜその構造なのか、どこを見ればよいかを優先する。
- AI 向けには、入口、正本、禁止事項、品質ゲートを明示する。
- 古い情報を残す場合は「legacy」「deprecated」「migration」などの状態を明示する。

## Pull Request Checklist for Docs

- `README.md` から必要な入口へ辿れる。
- `docs/README.md` に新規 docs が掲載されている。
- ディレクトリ構成や配置判断を変えた場合は `docs/project-structure.md` を更新した。
- 設計判断が増えた場合は ADR がある。
- `docs/system-overview.md` と `docs/development.md` が現行構造と矛盾していない。
- `AGENTS.md` と `.github/instructions/*.instructions.md` に規約重複がない。
- `CHANGELOG.md` の `[Unreleased]` に docs 変更を記録した。

## Reports

アーキテクチャ状態は以下で確認します。

```bash
pnpm run report:architecture-health
pnpm run report:large-files
```

`report:large-files` は Warn Only です。残件が出た場合は、次回以降のリファクタ計画へ反映してください。
