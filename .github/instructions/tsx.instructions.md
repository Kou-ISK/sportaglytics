---
applyTo: '**/*.tsx'
---

# TSX（React コンポーネント）向け指示

- Container（データ取得・状態・イベント連携）/ Hook（ロジック）/ View（描画）を分離し、責務を混在させない。
- MUI の `sx` とテーマ（`src/theme.ts`）を使い、色・余白・フォントのハードコードを避ける。
- `useEffect` / `useMemo` / `useCallback` の依存配列は正確に記述し、不要な再レンダリングを防ぐ。
- `window.electronAPI` を使う場合は存在チェックを行い、失敗時は安全にフォールバックまたは `console.debug` で記録する。
- データ未存在時の空状態表示と、失敗時のエラーステート（`Alert` / `Snackbar` 等）を実装する。
- ユーザー向け文言は日本語中心で統一し、同一画面内で表現ゆれを作らない。
