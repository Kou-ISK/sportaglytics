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
- [ ] ユーザー影響なし
- [ ] ユーザー影響あり（`docs/system-overview.md` / `docs/development.md` を更新）
