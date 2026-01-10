# Copilot への基本指示（SporTagLytics）

このリポジトリでコード提案を行う際は、以下の方針を常に優先してください。

## 技術スタック

- **React**: 18.3.1（関数コンポーネントのみ）
- **TypeScript**: 5.9.3（strict mode有効）
- **Electron**: 31.6.0
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
- アプリ全体で使うコンポーネント（チュートリアル、ヘルプ等）は `src/components/` に配置します。
- 機能内の共通 UI（`StatsCard`, `NoDataPlaceholder` 等）は各 feature 内の `view/` または `components/` で管理し、必要に応じて機能横断で再利用可能な形にリファクタリングします。

## 実装時の留意点

- 使い回す計算結果は `useMemo` / `useCallback` でメモ化します。
- 動画プレイヤー制御や同期ロジックは専用 Hook に切り出し、副作用を閉じ込めます。
- Electron 依存処理は必ず `window.electronAPI` 経由で呼び出します。
- 新しいチャートやタイムライン表示でも、既存のプレースホルダーや UI パターンを踏襲します。
- 既存の共通フック/コンポーネントを優先して再利用します（例: `useTimelineViewport`/`useTimelineInteractions`/`useTimelineEditDraft`/`useTimelineValidation`, `useMatrixAxes`/`useMatrixFilters`/`useActionBreakdown`, `StatsCard`/`StatsModalHeader`, `useUnsavedTabSwitch`, `useHotkeyBindings`, `useSyncActions` の `onSync*` コールバックなど）。

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

### ドキュメント構成

- **ユーザー向け**: README.md（概要・インストール・基本操作）, FAQ.md（よくある質問）
- **開発者向け**: DEVELOPMENT.md（環境構築・開発手順）, ARCHITECTURE.md（設計思想・技術選定）, TESTING.md（テスト戦略）, TROUBLESHOOTING.md（問題解決）
- **コミュニティ向け**: CONTRIBUTING.md（貢献ガイド）, CODE_OF_CONDUCT.md（行動規範）, SECURITY.md（脆弱性報告）
- **技術仕様書**: docs/ 配下（audio-sync-offset-specification.md, sctimeline-implementation.md, design-system.md 等）
- **変更履歴**: CHANGELOG.md（Keep a Changelog 形式）, ROADMAP.md（開発計画）

### ドキュメント更新ルール

- **ユーザー体験に影響する変更**（新機能、UI変更、挙動変更）を加えた場合:
  - README.md の該当セクションを更新（必要に応じて FAQ.md にも Q&A 追加）
  - CHANGELOG.md の `[Unreleased]` セクションに変更内容を記載（`feat:`, `fix:`, `chore:` 等のプレフィックスを使用）
- **アーキテクチャ変更**（新しいディレクトリ構造、設計パターン導入、技術スタック更新）:
  - ARCHITECTURE.md の該当セクションを更新
  - DEVELOPMENT.md の開発環境セットアップ手順も必要に応じて更新
- **技術仕様の追加・変更**（音声同期アルゴリズム、ファイルフォーマット等）:
  - docs/ 配下の該当ファイルを更新または新規作成
- **コード内コメント**: 複雑なビジネスルール、アルゴリズム、回避策（workaround）には短く意図を説明するコメントを付与します。
