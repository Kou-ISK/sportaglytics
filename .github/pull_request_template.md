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
