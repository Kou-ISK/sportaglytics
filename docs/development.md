# 開発ガイド

## 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [プロジェクト構造](#プロジェクト構造)
3. [技術スタック](#技術スタック)
4. [ビルドと実行](#ビルドと実行)
5. [開発ワークフロー](#開発ワークフロー)
6. [コーディング規約](#コーディング規約)
7. [アーキテクチャ](#アーキテクチャ)
8. [テストとデバッグ](#テストとデバッグ)
9. [リリースプロセス](#リリースプロセス)
10. [ドキュメント運用](#ドキュメント運用)

---

## 開発環境のセットアップ

### 必須要件

| ツール  | バージョン |
| ------- | ---------- |
| Node.js | 18.x 以上  |
| pnpm    | 9.1.0 以上 |
| Git     | 最新版     |

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/Kou-ISK/SporTagLytics.git
cd SporTagLytics

# 依存関係をインストール
pnpm install

# Electronアプリを開発モードで起動
pnpm run electron:dev
```

### エディタ設定（VS Code推奨）

**推奨拡張機能**:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features

---

## プロジェクト構造

```
SporTagLytics/
├── .github/                  # GitHub設定とCopilot指示
├── docs/                     # ドキュメント
│   └── adr/                  # Architecture Decision Records
├── electron/                 # Electronメインプロセス
│   └── src/
│       ├── main.ts          # 起動/組み立て
│       ├── preload.ts       # ドメインブリッジ合成
│       ├── ipc/             # IPCハンドラ登録（files/report/export等）
│       ├── preload/         # preloadドメインモジュール
│       ├── windowSecurity.ts
│       ├── menuBar.ts
│       └── ...
├── public/                   # 静的ファイル
├── src/                      # Reactアプリケーション
│   ├── main.tsx             # エントリーポイント
│   ├── App.tsx              # ルートコンポーネント
│   ├── components/          # 共通コンポーネント
│   │   └── ui/              # design-system（primitives/composites/patterns）
│   ├── contexts/            # Reactコンテキスト
│   ├── features/            # 機能別モジュール
│   │   ├── analysisReport/
│   │   ├── settings/
│   │   ├── playlist/
│   │   └── videoPlayer/
│   ├── hooks/               # 共通カスタムフックのみ
│   ├── pages/               # 薄い page wrapper のみ
│   ├── types/               # 型定義
│   └── utils/               # ユーティリティ関数
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### ディレクトリ責務

| ディレクトリ              | 責務                                       |
| ------------------------- | ------------------------------------------ |
| `electron/src/`           | Electronメインプロセス、IPC、ネイティブAPI |
| `src/components/`         | 共通UIコンポーネント                       |
| `src/components/ui/`      | 共通UI design-system（Shared UI限定）      |
| `src/contexts/`           | truly shared なグローバル状態のみ          |
| `src/features/<Feature>/` | 機能単位の UI / hook / context / domain    |
| `src/hooks/`              | truly shared な共通カスタムフックのみ      |
| `src/pages/`              | feature を呼び出す top-level wrapper のみ  |
| `src/types/`              | 共有型定義                                 |
| `src/utils/`              | 共通ユーティリティ関数（pure helper優先）  |

---

## 技術スタック

### フロントエンド

| 技術        | バージョン | 用途                     |
| ----------- | ---------- | ------------------------ |
| React       | 19.2.3     | UIライブラリ             |
| TypeScript  | 5.4.5      | 型安全な開発             |
| Material-UI | 7.3.7      | UIコンポーネント         |
| Recharts    | 3.6.0      | グラフ・チャート         |
| Vite        | 7.3.x      | renderer / preload build |

### 映像処理

| 技術          | バージョン | 用途                     |
| ------------- | ---------- | ------------------------ |
| Video.js      | 8.23.4     | 映像プレイヤー           |
| ffmpeg-static | 5.2.0      | クリップ書き出し（同梱） |
| Web Audio API | -          | 音声同期分析             |

**ffmpeg-static**:

- FFmpegバイナリを静的に同梱し、プラットフォーム固有のビルドを自動選択
- クリップ書き出し機能（単一/複数アングル、オーバーレイ付き）で使用
- IPC経由で進捗通知とキャンセル制御をサポート

### デスクトップアプリケーション

| 技術             | バージョン | 用途                 |
| ---------------- | ---------- | -------------------- |
| Electron         | 40.0.0     | デスクトップアプリ化 |
| electron-builder | 26.4.0     | アプリパッケージング |

### 開発ツール

| 技術   | バージョン | 用途                   |
| ------ | ---------- | ---------------------- |
| pnpm   | 9.1.0+     | パッケージマネージャー |
| Vite   | 7.x        | バンドラー             |
| ESLint | 9.39.2     | 静的解析               |
| Vitest | 4.x        | テスト                 |

---

## ビルドと実行

### 開発モード

```bash
pnpm run electron:dev
```

内部的に以下が実行されます:

1. `vite` で React アプリをホット起動
2. Vite の起動を待つ
3. React / Electron / preload を build して `electron .` でアプリを起動

Renderer のみ確認する場合は `pnpm start` を使用できます。

### 本番ビルド

```bash
# Reactアプリのビルド
pnpm run build

# Electronアプリのパッケージング（macOS）
pnpm run electron:package:mac
```

### テスト

```bash
# ユニットテスト
pnpm run test:run
```

### リンター

```bash
# ESLint実行
pnpm run lint

# TypeScript型チェック
pnpm run typecheck

# Electron側型チェック
pnpm run typecheck:electron

# アーキテクチャ境界チェック
pnpm run check:architecture

# アーキテクチャ健全性レポート（準拠率）
pnpm run report:architecture-health

# 大規模ファイル残件レポート（Warn Only）
pnpm run report:large-files
```

---

## 開発ワークフロー

### ブランチ戦略

```
main         ← 本番環境（リリースタグ）
  ↑
develop      ← 開発統合ブランチ
  ↑
feature/*    ← 機能開発ブランチ
```

### ブランチ命名規則

| プレフィックス | 用途             | 例                             |
| -------------- | ---------------- | ------------------------------ |
| `feature/`     | 新機能開発       | `feature/timeline-zoom`        |
| `fix/`         | バグ修正         | `fix/audio-sync-crash`         |
| `refactor/`    | リファクタリング | `refactor/timeline-components` |
| `docs/`        | ドキュメント     | `docs/update-readme`           |
| `chore/`       | ビルド設定等     | `chore/update-dependencies`    |

### コミットメッセージ規約（Conventional Commits）

```
<type>: <subject>

<body>

<footer>
```

**Type一覧**:

- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント
- `style`: コードフォーマット
- `test`: テスト追加・修正
- `chore`: ビルド設定・依存関係

**例**:

```
feat: タイムライン範囲選択機能を追加

Shiftキー + ドラッグで複数イベントを範囲選択可能に。
選択範囲はハイライト表示される。

Closes #123
```

### プルリクエスト

1. `develop` から `feature/*` ブランチを作成
2. 機能開発・テスト・ドキュメント更新
3. `pnpm run lint` / `pnpm run typecheck` / `pnpm run typecheck:electron` / `pnpm run check:architecture` を通す
4. `develop` へのプルリクエストを作成
5. レビュー後にマージ

---

## コーディング規約

### TypeScript

- **strict mode有効**: `tsconfig.json` で `"strict": true`
- **`any` の使用禁止**: やむを得ない場合はTODOコメント
- **型の明示**: 関数の戻り値は型を明示
- **型定義の共有**: `src/types/` に集約

**例**:

```typescript
// ❌ Bad
function processData(data: any) {
  return data.map((item: any) => item.value);
}

// ✅ Good
function processData(data: TimelineData[]): number[] {
  return data.map((item) => item.value);
}
```

### React

- **関数コンポーネントのみ**: クラスコンポーネント禁止
- **責務の分離**: ビュー（JSX）とロジック（hooks）を分離
- **useEffect依存配列**: 完全な依存配列を指定
- **クリーンアップ**: useEffectには必ずクリーンアップ関数

**例**:

```typescript
// ❌ Bad
useEffect(() => {
  const timer = setInterval(() => console.log('tick'), 1000);
}); // 依存配列なし、クリーンアップなし

// ✅ Good
useEffect(() => {
  const timer = setInterval(() => console.log('tick'), 1000);
  return () => clearInterval(timer);
}, []);
```

### Material-UI

- **`sx` プロパティ**: インラインスタイルは `sx` を使用
- **テーマの活用**: `theme.palette`, `theme.spacing`
- **レスポンシブ**: `theme.breakpoints`

### ファイル分割ポリシー

- **Soft Budget（Warn Only）**:
  `TSX <= 300行`, `TS <= 450行` は目安
- **必須**:
  行数に関係なく `UI描画` と `IPC/永続化` と `ドメイン計算` の責務混在を避ける
- **例外管理**:
  例外は `docs/architecture-exceptions.md` に記録する

### 命名規則

| 対象                | 規則        | 例                                   |
| ------------------- | ----------- | ------------------------------------ |
| Reactコンポーネント | PascalCase  | `TimelineEditor`, `AnalysisCard`     |
| カスタムフック      | camelCase   | `useTimelineViewport`, `useSettings` |
| ユーティリティ関数  | camelCase   | `formatTime`, `calculateOffset`      |
| 型定義              | PascalCase  | `TimelineData`, `VideoSyncState`     |
| 定数                | UPPER_SNAKE | `MAX_ZOOM_LEVEL`                     |

---

## アーキテクチャ

### Electron IPC通信

現行構成は「main は組み立て」「IPCはドメイン登録関数」「preload は型付きブリッジ合成」です。

**フロー**:

```
Renderer (React)
  ↓ window.electronAPI.<explicit method>
Preload (domain bridge)
  ↓ ipcRenderer.invoke/send
Main IPC handlers (domain modules)
  ↓ native APIs / filesystem
```

**Main側の分割例**:

- `electron/src/ipc/fileHandlers.ts`
- `electron/src/ipc/reportHandlers.ts`
- `electron/src/ipc/dashboardHandlers.ts`
- `electron/src/ipc/codeWindowHandlers.ts`
- `electron/src/ipc/exportHandlers.ts`
- `electron/src/ipc/llamaHandlers.ts`

**Preload側の分割例**:

- `electron/src/preload/appBridge.ts`
- `electron/src/preload/eventBridge.ts`
- `electron/src/preload/settingsBridge.ts`
- `electron/src/preload/analysisBridge.ts`
- `electron/src/preload/playlistBridge.ts`
- `electron/src/preload/codeWindowBridge.ts`

**Renderer API方針**:

- `window.electronAPI` から汎用 `on/off/send` は提供しない
- `onTimelineUndo`, `onMenuShowStats`, `notifyHotkeysUpdated` など用途別メソッドのみ公開
- `src` 側で `electron` / `ipcRenderer` の直接 import は禁止
- playlist / analysis window の IPC 契約は `src/types/ipc/playlistWindow.ts` / `src/types/ipc/analysisWindow.ts` を正本とし、channel 名・payload 型・型ガードを main / preload / renderer で共有する
- playlist / analysis window の renderer 側入口は `window.electronAPI.playlist` / `window.electronAPI.analysis` に限定し、window 専用イベントを top-level API へ散らさない
- settings の正規化は `src/types/settings/normalizers.ts` の `normalizeAppSettings` を正本とし、main / renderer で同じ補完ロジックを重複させない
- settings の正規化ロジックは `src/types/settings/normalizerUtils.ts` / `dashboardNormalizers.ts` / `codingPanelNormalizers.ts` に責務分割し、公開窓口は `normalizers.ts` に維持する
- playlist の共有契約は `src/types/playlist/core.ts` / `window.ts` / `api.ts` に分け、`src/types/Playlist.ts` は公開 facade に留める
- `src/types` の下位構成は `analysis/`, `timeline/`, `video/`, `package/`, `playlist/`, `settings/`, `ipc/` のようにユースケースで切る
- `analysis/core.ts` のような抽象ディレクトリ名は優先しない。`view.ts`, `momentum.ts`, `matrix.ts` のように実際の契約名をそのままファイル名に使う
- root 直下の `src/types/*.ts` は互換 facade とみなし、新規の実体は use-case 配下へ追加する
- Renderer の複雑な hook は `Controller/Hook -> Gateway/Helper -> View/Domain` に分け、IPC 登録・payload 正規化・state 適用を同一関数へ詰め込まない
- 例: playlist window は gateway + data/interaction runtime、audio sync は stage helper + orchestration に分割する
- `App.tsx` は app shell の view switch のみに留め、hash / Electron event / external open は shared hook に抽出する
- `localStorage` や Electron menu sync は feature hook へ直書きせず、gateway / storage helper に寄せる
- preload の `on/off` ペアは typed listener store を介して wrapper を管理し、`as unknown as Function` に依存しない
- menu 系 listener も cleanup 関数を返す typed 登録 API に統一し、`removeAllListeners` を使った singleton listener 上書きは行わない
- preload の playlist / analysis bridge は outbound / inbound の両方向で payload guard を通し、無効 payload を main / renderer に流さない
- main process の window 系 handler は `electron/src/ipc/windowSenderGuards.ts` を通して sender を検証し、main window / sub window の送信元境界を明確に分ける
- shared domain の大きい集計関数は facade と builder 群に分け、stat family 単位で責務を切り出す
- timeline import/export は gateway と pure service に分け、menu 購読・dialog・serialize/deserialize を 1 hook に詰め込まない
- clip export の共通契約は `src/shared/clipExport/` に置き、playlist / timeline 両方の source 解決・multi/all-angles 実行・payload 型をそこへ集約する
- analysis dashboard import/export は controller 直下で I/O しない。dialog / read-write は gateway、JSON parse / 正規化 / ID 重複解消は pure service に分離する
- Video.js の既存 player 参照と時刻操作は feature 内 adapter に寄せ、hook ごとに独自 cast を持ち込まない

**ローカルファイルアクセス方針**:

- `fetch(filePath)` は使用しない
- `readJsonFile` / `readTextFile` / `readBinaryFile` を利用
- `src/utils` は pure function / pure helper に限定し、Electron I/O は feature の controller / gateway 側へ置く

**セキュリティ既定**:

- 全 BrowserWindow: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`
- `electron/src/windowSecurity.ts` で `window.open` 拒否と不要ナビゲーション拒否を適用
- IPC handler で payload/sender 検証を実施

### 運用補助

- 月次の巨大ファイル残件レポート:
  `pnpm run report:large-files`
- アーキテクチャ準拠率レポート:
  `pnpm run report:architecture-health`
- 長期的な設計判断:
  `docs/adr/`

### 状態管理

**React Context**:

- `ActionPresetContext`: アクションプリセット
- `NotificationContext`: 通知システム
- `ThemeModeContext`: テーマ切替

**カスタムフック**:

- `useSettings`: Electron設定の読み書き
- `useVideoPlayerScreenController`: 映像プレイヤー全体の状態管理
- `useTimelineViewport`: タイムラインのズーム・スクロール
- `useTimelineInteractions`: タイムラインのインタラクション
- `useGlobalHotkeys`: グローバルホットキー

### コンポーネント設計（責務分離）

- `Screen`: feature の入口。画面構成と feature 合成を担当
- `Controller/Hook`: 状態管理、ユースケース、外部連携、副作用を担当
- `View`: props と callback だけで描画できる UI。`window.electronAPI` / URL / 永続化へ直接依存しない
- `Gateway`: Electron・URL・永続化など外部境界の薄い抽象化

```typescript
// ❌ Bad: ビューとロジックが混在
function TimelineEditor() {
  const [zoom, setZoom] = useState(1);
  const handleWheel = (e: WheelEvent) => { /* ... */ };

  useEffect(() => {
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return <div>{/* JSX */}</div>;
}

// ✅ Good: フックとビューを分離
function useTimelineZoom() {
  const [zoom, setZoom] = useState(1);
  const handleWheel = useCallback((e: WheelEvent) => { /* ... */ }, []);

  useEffect(() => {
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return { zoom, setZoom };
}

function TimelineEditorView({ zoom }: { zoom: number }) {
  return <div>{/* JSX */}</div>;
}

function TimelineEditor() {
  const { zoom } = useTimelineZoom();
  return <TimelineEditorView zoom={zoom} />;
}
```

### 主要カスタムフック一覧

プロジェクト全体で使用される主要なカスタムフックと役割:

| フック名                         | ファイルパス                                                           | 用途                                         |
| -------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `useVideoPlayerScreenController` | `src/features/videoPlayer/app/hooks/useVideoPlayerScreenController.ts` | video player 画面の状態管理                  |
| `useSettings`                    | `src/hooks/useSettings.ts`                                             | Electron設定の読み書き                       |
| `useGlobalHotkeys`               | `src/hooks/useGlobalHotkeys.ts`                                        | グローバルホットキー登録・解除               |
| `useTimelineHistory`             | `src/features/videoPlayer/app/hooks/useTimelineHistory.ts`             | Undo/Redo履歴管理                            |
| `useTimelinePersistence`         | `src/features/videoPlayer/app/hooks/useTimelinePersistence.ts`         | タイムラインの永続化（自動保存）             |
| `useSyncActions`                 | `src/features/videoPlayer/app/hooks/useSyncActions.ts`                 | 音声同期操作（再実行・リセット・手動同期等） |
| `useUnsavedTabSwitch`            | `src/features/settings/hooks/useUnsavedTabSwitch.ts`                   | 未保存変更検知とタブ切り替え確認             |
| `useHotkeySettingsController`    | `src/features/settings/components/useHotkeySettingsController.ts`      | ホットキー設定の管理と競合チェック           |

### 主要ユーティリティ関数一覧

共通処理の主な配置は次の通りです。古い root-level utility 名を前提にせず、現行の domain / feature 配置を確認してください。

| Domain                 | Current location                                                    | Notes                                       |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| timeline import/export | `src/features/videoPlayer/app/utils/timelineImportExportService.ts` | UI hook から serialize / deserialize を分離 |
| SCTimeline conversion  | `src/utils/scTimelineConverter.ts`                                  | Sportscode 互換変換                         |
| timeline CSV / JSON    | `src/utils/timelineExport.ts`                                       | app timeline format / CSV                   |
| label extraction       | `src/utils/labelExtractors.ts`                                      | labels 中心モデルの抽出                     |
| matrix build/export    | `src/utils/matrixBuilder.ts`, `src/utils/matrixExport.ts`           | クロス集計と CSV/XLSX 出力                  |
| clip export            | `src/shared/clipExport/`                                            | source validation / execution plan          |
| analysis shared domain | `src/shared/analysis/`                                              | event insights / AI context / chart data    |
| report generation      | `src/report/`                                                       | analysis report data and pagination         |
| audio sync             | `src/utils/AudioSyncAnalyzer.ts`, `src/utils/audioSync/`            | waveform decode / sync analysis             |

---

## テストとデバッグ

テスト運用の詳細は [Testing and Quality Gates](testing.md) を参照してください。

現行 test runner は Vitest です。新規 test は `vitest` から `describe`, `it`, `expect`, `vi` を import します。React hook / component test では `@testing-library/react` を使い、DOM が必要な場合は `/* @vitest-environment jsdom */` を付けます。

### デバッグ

**React DevTools**:

- コンポーネント階層の確認
- State/Propsの監視

**Electron DevTools**:

- メインウィンドウで `Cmd+Option+I`
- Console, Network, Performanceタブを活用

---

## リリースプロセス

リリース手順の正本は [.github/RELEASE.md](../.github/RELEASE.md) です。Homebrew Cask の詳細は [homebrew-distribution.md](homebrew-distribution.md) を参照してください。

ローカル確認の最低限:

```bash
pnpm run build
pnpm exec tsc -p electron/tsconfig.json
pnpm run bundle:preload
pnpm run check:preload
pnpm run electron:package:mac
```

---

## ドキュメント運用

- ドキュメント入口は [docs/README.md](README.md)。
- ドキュメント運用ルールは [docs/documentation-guide.md](documentation-guide.md)。
- 実装変更時の更新先は [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix) に従う。
- ディレクトリ構成と配置判断は [docs/project-structure.md](project-structure.md)。
- 長期的な設計判断は [docs/adr/README.md](adr/README.md) に ADR として記録する。
- 実装規約の正本は [AGENTS.md](../AGENTS.md)。`.github/instructions/*.instructions.md` には差分ルールだけを書く。
- ユーザー影響または設計変更がある PR では、`docs/system-overview.md` と `docs/development.md` の同期要否を確認する。
- docs 更新不要の場合も PR に理由を記載する。
- 新規ドキュメントを追加した場合は `docs/README.md` に掲載する。

---

## トラブルシューティング

### ビルドエラー: `Module not found`

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Electron起動エラー

```bash
pnpm remove electron
pnpm add -D electron
```

### 型エラー

1. `src/renderer.d.ts` でElectron APIの型定義を確認
2. `tsconfig.json` の `include` に該当ファイルが含まれているか確認

---

## 内部ドキュメント

- [ドキュメント索引](README.md)
- [システム概要](system-overview.md)
- [プロジェクト構成](project-structure.md)
- [ADR](adr/README.md)
- [ドキュメント運用ガイド](documentation-guide.md)
- [Testing and Quality Gates](testing.md)
- [技術仕様](requirement.md)
- [設計ガイド](design-system.md)
- [AI Analysis and Local LLM Setup](ai-analysis.md)
- [Analysis Report Export](analysis-report.md)
- [Privacy and Data Handling](privacy-and-data-handling.md)
- [プレイリスト機能実装](playlist-features.md)
- [コードウィンドウ設定実装](code-window-settings.md)
- [音声同期オフセット仕様](audio-sync-offset-specification.md)
- [SCTimeline実装](sctimeline-implementation.md)

---

## 参考資料

- [Electron公式ドキュメント](https://www.electronjs.org/docs)
- [React公式ドキュメント](https://react.dev/)
- [Material-UI公式ドキュメント](https://mui.com/)
- [Video.js公式ドキュメント](https://videojs.com/)

---

## コントリビューション

詳細は [CONTRIBUTING.md](../CONTRIBUTING.md) を参照してください。
