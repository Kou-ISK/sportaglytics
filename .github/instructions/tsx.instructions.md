---
applyTo: '**/*.tsx'
---

# TSX（React コンポーネント）向け指示

## コンポーネント設計

- コンポーネントは責務単位で分割し、ロジックは可能な限りカスタム Hook に移譲する。
- View と Logic を分離: 純粋な JSX は `view/` ディレクトリ、状態管理・副作用は `hooks/` ディレクトリに配置。
- 機能内の共通 UI コンポーネント(`StatsCard`, `NoDataPlaceholder`, `StatsModalHeader` 等)は feature 内の `view/` または `components/` で管理。
- アプリ全体で使うコンポーネント(`OnboardingTutorial`, `QuickHelpFab`, `ShortcutGuide`)は `src/components/` に配置。

## UI レイアウト

- UI レイアウトには MUI の `Box` / `Stack` / `Grid` を使用し、`sx` でレスポンシブ調整を行う。
- スタイルは `sx` プロパティで定義し、別途 CSS ファイルを作成しない。
- テーマ対応: `theme.palette` を使用し、ダークモードを考慮した色指定を行う。

## パフォーマンス最適化

- `useEffect` / `useMemo` / `useCallback` には依存配列を正確に設定し、不要な再レンダリングを防ぐ。
- 高コストな計算(タイムラインフィルタリング、統計集計等)は `useMemo` でメモ化。
- コールバック関数は `useCallback` でメモ化し、子コンポーネントへの不要な再レンダリングを防ぐ。

## Electron 統合

- `window.electronAPI` へアクセスする際は存在チェックを行う:
  ```tsx
  if (window.electronAPI) {
    const result = await window.electronAPI.someMethod();
  }
  ```
- 例外発生時は `console.debug` で記録し、ユーザーには適切なエラーメッセージを表示。
- IPC 呼び出しは直接コンポーネントに書かず、カスタム Hook に集約する。

## 空状態表示

- タイムライン・分析 UI は空状態の表示を必ず提供する。
- 空状態コンポーネントの例: `NoDataPlaceholder` (`src/features/videoPlayer/components/Analytics/StatsModal/view/NoDataPlaceholder.tsx`)
- メッセージはユーザーに次のアクションを促す内容にする(例: 「タイムラインを作成してください」)。

## 国際化 (i18n)

- ユーザー向けテキストは日本語で記載。
- ハードコード文字列を定数化する場合は `labels` 等のオブジェクトにまとめる:
  ```tsx
  const labels = {
    title: 'タイムライン編集',
    save: '保存',
    cancel: 'キャンセル',
  };
  ```
- コンソールログや技術的なメッセージは英語で記載しても良い。

## 共通フックの再利用

新規機能実装時は、以下の既存フックを優先して再利用:

- **タイムライン関連**: `useTimelineViewport`, `useTimelineInteractions`, `useTimelineSelection`, `useTimelineEditDraft`, `useTimelineValidation`
- **分析 UI**: `useMatrixAxes`, `useMatrixFilters`, `useActionBreakdown`, `useStatsModalState`
- **設定管理**: `useSettings`, `useUnsavedTabSwitch`
- **同期処理**: `useSyncActions` (通知は `onSyncInfo/onSyncWarning/onSyncError` で受け取る)
- **ホットキー**: `useHotkeyBindings`, `useGlobalHotkeys`

## エラーハンドリング

- エラーバウンダリを使用し、予期しないエラーをキャッチする。
- ユーザーには `useNotification` コンテキストを使用してエラーメッセージを表示。
- 開発者向けの詳細は `console.debug` で記録。
