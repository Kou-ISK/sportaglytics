---
applyTo: '**/*.ts,**/*.tsx'
---

# TypeScript 向け指示

- 既存型（例: `TimelineData`, `VideoSyncData`, `RechartsData`）を優先して再利用し、重複定義を避ける。
- `any` は原則使わず、必要時は `unknown` と型ガードで絞り込む。
- exported 関数・メソッドは戻り値型を明示する。
- 型のみの import は `import type` を優先する。
- 無根拠な `as` 断定キャストを避ける。型設計で解決できる場合はそちらを優先する。
- feature 間で内部実装ファイルを直接 import しない。再利用が必要なら `src/components` / `src/hooks` / `src/utils` / `src/types` へ共通化する。
- 非同期処理は `async/await` を基本とし、エラー処理方針（伝搬 or ハンドリング）を明示する。
