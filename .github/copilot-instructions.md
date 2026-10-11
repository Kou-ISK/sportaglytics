# Copilot Repository Instructions（SporTagLytics）

このファイルは Copilot 向けの入口ガイドです。規約本文は `AGENTS.md` を正本とします。

## 参照順序

1. `AGENTS.md`
2. `.github/copilot-instructions.md`
3. `.github/instructions/*.instructions.md`
4. `.github/technical-instructions.md`

## Copilot への必須指示

1. 実装・提案は常に `AGENTS.md` を基準に解釈する。
2. 変更対象に一致する `.github/instructions/*.instructions.md` の `applyTo` 差分を適用する。
3. 階層 `AGENTS.md` があれば対象範囲の補足として読み、競合はルート `AGENTS.md` の「適用範囲と競合の扱い」に従う。`applyTo` の具体性だけで共通規約を緩めない。
4. 一般規約を `.instructions.md` に再記述しない。
5. 実装前後で品質ゲート通過を前提にする。
6. 設計判断を変更する場合は `docs/adr/` を確認し、必要に応じて ADR を追加・更新する。
7. ADR を追加・更新する場合は `docs/documentation-guide.md` の ADR Operations に従い、`pnpm run check:adr` を実行する。
8. 仕様・設計・ユーザー影響・開発手順・配置判断が変わる場合は `docs/documentation-guide.md` の Docs Impact Matrix に従って docs を同時更新する。
9. ドキュメントを追加する場合は `docs/README.md` と `docs/documentation-guide.md` を確認する。
10. ブランチ名とコミットメッセージは `AGENTS.md` の Git / ブランチ / コミット運用に従う。

## 品質ゲート

[docs/testing.md](../docs/testing.md#required-quality-gate) を参照する。実行環境、コマンド、結果、未実施範囲をPRに残し、AI生成部分も提出者がレビューする。

## 主要ドキュメント

- `docs/README.md`: ドキュメント索引
- `docs/system-overview.md`: 現行アーキテクチャ要約
- `docs/project-structure.md`: ディレクトリ構成と配置判断
- `docs/adr/README.md`: Architecture Decision Records
- `docs/documentation-guide.md`: ドキュメント運用
