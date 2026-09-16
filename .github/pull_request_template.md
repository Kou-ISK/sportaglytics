## Summary

- 目的:
- 主な変更:

## Scope

- [ ] In scope を記載
- [ ] Out of scope を記載

## Architecture Impact

- [ ] 依存方向（`pages -> features -> shared`）を壊していない
- [ ] feature 外からは `src/features/<feature>/index.ts` 経由 import のみ
- [ ] Renderer は `window.electronAPI` 経由のみ
- [ ] Electron セキュリティ設定を緩和していない
- [ ] 長期的な設計判断がある場合、`docs/adr/` を追加・更新した

## Responsibility Split

- [ ] 変更ファイルの責務分離方針を記載した
- [ ] 巨大ファイル（目安: TSX 300+, TS 450+）を変更した場合、分割したか理由を記載した
- [ ] 例外がある場合 `docs/architecture-exceptions.md` に登録した

### Notes for Large Files

- 対象ファイル:
- 実施した分割:
- 今回見送った理由と次回対応期限:

## Quality Gate

- [ ] `pnpm run typecheck`
- [ ] `pnpm run typecheck:electron`
- [ ] `pnpm run lint`
- [ ] `pnpm run check:architecture`
- [ ] `pnpm run test:run`

## Public Data Review

- [ ] [公開時のデータ取り扱い](../docs/privacy-and-data-handling.md#sharing-and-issue-reports)に従い、差分・PR本文・添付ログ/画像・コミット情報を確認した
- [ ] 公開許可のない個人情報、実試合の識別情報、ローカルパス、私的なアカウント状態を含めていない

## UI / Design System Impact

- [ ] UI変更なし
- [ ] `docs/design-system.md` に準拠し、既存のshared UI / tokenを確認した
- [ ] dark / light、keyboard、focus-visible、disabled / empty / loading / errorを確認した
- [ ] Storyを追加・更新し、a11yチェックを確認した
- [ ] visual regressionを確認した

### Visual Evidence

- Dark:
- Light:

## User Impact / Docs

- [ ] Docs Impact Matrix（`docs/documentation-guide.md`）を確認した
- [ ] ユーザー影響なし（理由を下に記載）
- [ ] ユーザー影響あり（該当 docs を更新）
- [ ] ADR を追加・更新した場合、ADR Operations に従い `docs/adr/README.md` も更新した
- [ ] ADR を追加・更新した場合、`pnpm run check:adr` を実行した
- [ ] 新規ドキュメントを追加した場合、`docs/README.md` に掲載した
- [ ] ディレクトリ構成・配置判断を変更した場合、`docs/project-structure.md` を更新した
- [ ] ドキュメント運用に関わる変更は `docs/documentation-guide.md` と矛盾していない
- Docs impact / no-docs reason:
