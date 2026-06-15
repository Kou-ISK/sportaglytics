---
applyTo: '**/*.tsx'
---

# React TSX Files (`*.tsx`)

このファイルで定義するのは `applyTo` 対象の差分ルールのみです。一般規約は `AGENTS.md` を参照してください。

1. 表示（View）と状態/副作用（Container/Hook）を分離する。
2. `useEffect` は依存配列と cleanup を省略しない。
3. 計算量の大きい派生値は `useMemo`、イベントハンドラは `useCallback` で安定化する。
4. 空状態・エラー状態を明示的に描画する。
