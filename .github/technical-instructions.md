# Technical Notes - SporTagLytics

このファイルは背景メモ専用です。規約本文は `AGENTS.md` を正本とし、ここへ重複記載しません。

## 運用メモ
1. 規約変更はまず `AGENTS.md` を更新する。
2. Copilot の適用範囲制御は `.github/instructions/*.instructions.md` の `applyTo` で行う。
3. 行数ルールは Soft Budget（Warn Only）で運用し、境界違反・型・テストを優先して修正する。

## 実行手順の参照先

セットアップは [開発環境](../docs/development.md#開発環境)、検証範囲と実行コマンドは [Testing and Quality Gates](../docs/testing.md#required-quality-gate) を参照する。版・コマンドをこの背景メモへ複製しない。
