# Copilot への基本指示（SporTagLytics）

このリポジトリでコード提案を行う際は、以下の方針を常に優先してください。

## 技術スタック

- **React**: 18.3.1（関数コンポーネントのみ）
- **TypeScript**: 5.9.3（strict mode有効）
- **Electron**: 31.7.7
- **Material-UI**: 5.18.0
- **Video.js**: 8.23.4
- **パッケージマネージャー**: pnpm 9.1.0+

## 全体方針

- すべて TypeScript で実装し、`any` の使用は Avoid します（やむを得ない場合は TODO を添える）。
- React 18 の関数コンポーネントのみ使用し、責務は小さく保ちます。
- UI は Material UI を標準とし、`sx` プロパティでスタイルを調整します。
- `useEffect` には完全な依存配列とクリーンアップを必ず定義します。

## 構造と命名

- React コンポーネントとそれを格納するディレクトリ／ファイルは **PascalCase** で命名します。
- ロジック専用モジュール（ユーティリティ、サービス、hook本体など）のファイル名は **camelCase** を用います。
- カスタム Hook は `useXxx.ts` 形式で、`src/hooks` または `src/features/videoPlayer/**/hooks` に配置します。
- 共有型は `src/types` にまとめ、既存の `TimelineData` などを再利用します。
- Barrels（再エクスポート用 index）は循環参照を作らない範囲でシンプルに保ちます。

## ディレクトリ構成と責務分離

- 機能単位で `src/features/<FeatureName>/` を作り、その配下に `components/`, `hooks/`, `utils/` などの責務別ディレクトリを設けます。
- 各コンポーネント配下では `view/`（純粋な JSX・スタイル）と `hooks/`（状態・副作用）、`types/`（型）を分け、ビューはロジックを直接持たない構成にします。
- ページ固有のレイアウトは `src/pages/<PageName>/components` / `hooks` へ配置し、feature への依存方向が一方向になるよう保ちます。
- Electron 依存処理は `src/services/electron/` にまとめ、React 側はそのサービス層を介して IPC を呼び出します。
- 共通 UI（ボタン、モーダル等）は `src/components/common/` へ集約し、重複実装を防ぎます。

## 実装時の留意点

- 使い回す計算結果は `useMemo` / `useCallback` でメモ化します。
- 動画プレイヤー制御や同期ロジックは専用 Hook に切り出し、副作用を閉じ込めます。
- Electron 依存処理は必ず `window.electronAPI` 経由で呼び出します。
- 新しいチャートやタイムライン表示でも、既存のプレースホルダーや UI パターンを踏襲します。

## Electron 31 対応

- `electron-localshortcut` は使用不可（削除済み）。代わりに `globalShortcut` を使用します。
- `BrowserWindow` の型アサーションが必要な場合があります（`webContents` アクセス時）。
- メインプロセスでは `contextIsolation: true` を維持します。

## 品質保証

- 変更後は `pnpm exec tsc --noEmit` を実行し、型エラーがない状態で提案します。
- 重要なユーティリティを変更する場合はテスト（ユニット or 実機確認）を追加／実行します。
- タイムライン永続化や同期機能に触れる修正では回帰が起きないよう手動検証します。
- ESLintの未使用変数エラーは必ず解消します（ビルドエラーの原因となります）。

## ドキュメント

- ユーザー体験に影響する変更を加えた場合は、関連ドキュメント（`docs/` 等）を更新します。
- 複雑なビジネスルールがある箇所には短く意図を説明するコメントを付与します。
