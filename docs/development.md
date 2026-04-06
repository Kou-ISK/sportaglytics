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

# 開発モードで起動
pnpm start
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

| 技術         | バージョン | 用途             |
| ------------ | ---------- | ---------------- |
| React        | 19.2.3     | UIライブラリ     |
| TypeScript   | 5.4.5      | 型安全な開発     |
| Material-UI  | 7.3.7      | UIコンポーネント |
| Recharts     | 3.6.0      | グラフ・チャート |
| React Router | 7.12.0     | ルーティング     |

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
pnpm start
```

内部的に以下が実行されます:

1. `vite` でReactアプリをホット起動
2. `tsc` でElectronメインプロセスをトランスパイル
3. `electron .` でアプリを起動

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
- Renderer の複雑な hook は `Controller/Hook -> Gateway/Helper -> View/Domain` に分け、IPC 登録・payload 正規化・state 適用を同一関数へ詰め込まない
- 例: playlist window は gateway + data/interaction runtime、audio sync は stage helper + orchestration に分割する
- `App.tsx` は app shell の view switch のみに留め、hash / Electron event / external open は shared hook に抽出する
- `localStorage` や Electron menu sync は feature hook へ直書きせず、gateway / storage helper に寄せる
- preload の `on/off` ペアは typed listener store を介して wrapper を管理し、`as unknown as Function` に依存しない
- preload の playlist / analysis bridge は outbound / inbound の両方向で payload guard を通し、無効 payload を main / renderer に流さない
- main process の window 系 handler は `electron/src/ipc/windowSenderGuards.ts` を通して sender を検証し、main window / sub window の送信元境界を明確に分ける
- shared domain の大きい集計関数は facade と builder 群に分け、stat family 単位で責務を切り出す

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

共通処理を提供するユーティリティ関数:

| 関数名                      | ファイルパス                             | 用途                                     |
| --------------------------- | ---------------------------------------- | ---------------------------------------- |
| `formatTime`                | `src/utils/formatTime.ts`                | 秒数を "HH:MM:SS" 形式に変換             |
| `parseTimeString`           | `src/utils/parseTimeString.ts`           | "HH:MM:SS" 形式を秒数に変換              |
| `calculateDuration`         | `src/utils/calculateDuration.ts`         | 開始・終了時刻から継続時間を計算         |
| `extractLabels`             | `src/utils/extractLabels.ts`             | タイムラインからラベル一覧を抽出         |
| `buildCrossTabMatrix`       | `src/utils/buildCrossTabMatrix.ts`       | クロス集計マトリクスを構築               |
| `replaceTeamPlaceholders`   | `src/utils/replaceTeamPlaceholders.ts`   | `${Team1}` / `${Team2}` をチーム名に置換 |
| `checkHotkeyConflicts`      | `src/utils/checkHotkeyConflicts.ts`      | ホットキー競合をチェック                 |
| `convertToSCTimeline`       | `src/utils/convertToSCTimeline.ts`       | TimelineData → SCTimeline形式に変換      |
| `convertFromSCTimeline`     | `src/utils/convertFromSCTimeline.ts`     | SCTimeline → TimelineData形式に変換      |
| `filterTimelineByDateRange` | `src/utils/filterTimelineByDateRange.ts` | 時間範囲でタイムラインをフィルタ         |
| `groupTimelineByAction`     | `src/utils/groupTimelineByAction.ts`     | アクション別にタイムラインをグループ化   |
| `calculatePossessionStats`  | `src/utils/calculatePossessionStats.ts`  | ポゼッション統計を計算                   |
| `exportToCSV`               | `src/utils/exportToCSV.ts`               | タイムラインをCSV形式でエクスポート      |
| `sanitizeFilename`          | `src/utils/sanitizeFilename.ts`          | ファイル名から不正な文字を除去           |

**使用例**:

```typescript
import { formatTime } from '@/utils/formatTime';
import { buildCrossTabMatrix } from '@/utils/buildCrossTabMatrix';

const timeString = formatTime(125.5); // "00:02:05"
const matrix = buildCrossTabMatrix(timeline, 'action', 'result');
```

---

## テストとデバッグ

### ユニットテスト（Jest + React Testing Library）

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineEditor } from './TimelineEditor';

test('タイムラインエディタが正しくレンダリングされる', () => {
  render(<TimelineEditor data={mockData} />);
  expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
});

test('イベントをクリックすると選択される', () => {
  const onSelect = jest.fn();
  render(<TimelineEditor data={mockData} onSelect={onSelect} />);

  fireEvent.click(screen.getByText('パス'));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ action: 'パス' }));
});
```

### デバッグ

**React DevTools**:

- コンポーネント階層の確認
- State/Propsの監視

**Electron DevTools**:

- メインウィンドウで `Cmd+Option+I`
- Console, Network, Performanceタブを活用

---

## リリースプロセス

### バージョニング（Semantic Versioning）

- `MAJOR`: 互換性のない変更
- `MINOR`: 後方互換性のある機能追加
- `PATCH`: 後方互換性のあるバグ修正

### リリース手順

1. **バージョン更新**:

```bash
pnpm version minor
```

2. **CHANGELOG更新**:

- `CHANGELOG.md` に変更内容を記載

3. **ビルド & テスト**:

```bash
pnpm run build
pnpm test
pnpm exec tsc --noEmit
```

4. **Git タグ**:

```bash
git add .
git commit -m "chore: release v<version>"
git tag v<version>
git push origin <default-branch> --tags
```

5. **GitHub Release**:

- GitHub上でReleaseを作成
- CHANGELOGから変更内容をコピー
- ビルド成果物を添付

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

- [システム概要](system-overview.md)
- [技術仕様](requirement.md)
- [設計ガイド](design-system.md)
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
