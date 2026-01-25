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
│       ├── main.ts          # エントリーポイント
│       ├── preload.ts       # プリロードスクリプト
│       ├── menuBar.ts       # メニューバー
│       ├── settingsManager.ts
│       ├── playlistWindow.ts
│       └── ...
├── public/                   # 静的ファイル
├── src/                      # Reactアプリケーション
│   ├── main.tsx             # エントリーポイント
│   ├── App.tsx              # ルートコンポーネント
│   ├── components/          # 共通コンポーネント
│   ├── contexts/            # Reactコンテキスト
│   ├── features/            # 機能別モジュール
│   │   ├── playlist/
│   │   └── videoPlayer/
│   ├── hooks/               # カスタムフック
│   ├── pages/               # ページコンポーネント
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
| `src/contexts/`           | グローバル状態管理（React Context）        |
| `src/features/<Feature>/` | 機能単位のコンポーネント・フック・型       |
| `src/hooks/`              | 共通カスタムフック                         |
| `src/pages/`              | ページレベルのコンポーネント               |
| `src/types/`              | 共有型定義                                 |
| `src/utils/`              | 共通ユーティリティ関数                     |

---

## 技術スタック

### フロントエンド

| 技術         | バージョン | 用途             |
| ------------ | ---------- | ---------------- |
| React        | 19.2.3     | UIライブラリ     |
| TypeScript   | 5.9.3      | 型安全な開発     |
| Material-UI  | 7.3.7      | UIコンポーネント |
| Recharts     | 3.6.0      | グラフ・チャート |
| React Router | 7.12.0     | ルーティング     |

### 映像処理

| 技術          | 用途             |
| ------------- | ---------------- |
| Video.js      | 映像プレイヤー   |
| FFmpeg        | クリップ書き出し |
| Web Audio API | 音声同期分析     |

### デスクトップアプリケーション

| 技術             | バージョン | 用途                 |
| ---------------- | ---------- | -------------------- |
| Electron         | 40.0.0     | デスクトップアプリ化 |
| electron-builder | 26.4.0     | アプリパッケージング |

### 開発ツール

| 技術    | バージョン | 用途                   |
| ------- | ---------- | ---------------------- |
| pnpm    | 9.1.0+     | パッケージマネージャー |
| Vite    | 7.x        | バンドラー             |
| ESLint  | 8.57.1     | 静的解析               |
| Vitest  | 4.x        | テスト                 |

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
pnpm run package:mac
```

### テスト

```bash
# ユニットテスト
pnpm test

# カバレッジ計測
pnpm test:coverage
```

### リンター

```bash
# ESLint実行
pnpm lint

# TypeScript型チェック
pnpm exec tsc --noEmit
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
3. `pnpm lint` と `pnpm exec tsc --noEmit` で型エラーがないことを確認
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

**フロー**:

```
React (Renderer Process)
  ↓ window.electronAPI.xxx()
Preload Script (preload.ts)
  ↓ ipcRenderer.invoke()
Main Process (main.ts)
  ↓ ipcMain.handle()
ネイティブAPI / ファイルシステム
```

**実装例**:

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
});

// main.ts
ipcMain.handle('read-file', async (_event, filePath: string) => {
  return await fs.promises.readFile(filePath, 'utf-8');
});

// React側
const data = await window.electronAPI.readFile('/path/to/file.json');
```

### 状態管理

**React Context**:

- `ActionPresetContext`: アクションプリセット
- `NotificationContext`: 通知システム
- `PlaylistContext`: プレイリスト状態
- `ThemeModeContext`: テーマ切替

**カスタムフック**:

- `useSettings`: Electron設定の読み書き
- `useVideoPlayerApp`: 映像プレイヤー全体の状態管理
- `useTimelineViewport`: タイムラインのズーム・スクロール
- `useTimelineInteractions`: タイムラインのインタラクション
- `useGlobalHotkeys`: グローバルホットキー

### コンポーネント設計（責務分離）

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
