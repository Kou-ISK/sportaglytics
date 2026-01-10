# 開発ガイド

> **関連ドキュメント**  
> [CONTRIBUTING.md](CONTRIBUTING.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | [README.md](README.md)

このドキュメントは、SporTagLyticsの開発環境セットアップと開発ワークフローの詳細を説明します。

---

## 目次

1. [前提条件](#前提条件)
2. [開発環境セットアップ](#開発環境セットアップ)
3. [ディレクトリ構成](#ディレクトリ構成)
4. [開発ワークフロー](#開発ワークフロー)
5. [デバッグ](#デバッグ)
6. [ビルドとテスト](#ビルドとテスト)
7. [推奨IDE設定](#推奨ide設定)

---

## 前提条件

開発を開始する前に、以下をインストールしてください。

### 必須

- **Node.js**: 18.0.0以上

  ```bash
  node --version  # v18.0.0以上を確認
  ```

- **pnpm**: 9.0.0以上

  ```bash
  npm install -g pnpm
  pnpm --version  # 9.0.0以上を確認
  ```

- **Git**: バージョン管理
  ```bash
  git --version
  ```

### 推奨

- **VSCode**: 推奨エディタ（拡張機能設定あり）
- **Xcode Command Line Tools** (macOS): ネイティブモジュールのビルドに必要
  ```bash
  xcode-select --install
  ```

---

## 開発環境セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/Kou-ISK/sportaglytics.git
cd sportaglytics
```

### 2. 依存関係のインストール

```bash
pnpm install
```

これにより、`package.json`に記載されたすべての依存関係がインストールされます。

### 3. 開発モードで起動

```bash
pnpm run electron:dev
```

これにより、ReactアプリとElectronアプリが同時に起動します：

- Reactアプリ: http://localhost:3000（開発サーバー）
- Electronウィンドウ: メインアプリケーションウィンドウ

ファイルを編集すると、Reactはホットリロード、Electronは手動再起動が必要です。

### 4. 本番ビルドで起動

```bash
pnpm run electron:start
```

Reactアプリを本番ビルド後、Electronで起動します。

---

## ディレクトリ構成

```
sportaglytics/
├── src/                            # Reactアプリケーション
│   ├── features/                   # 機能単位のモジュール
│   │   ├── playlist/               # プレイリスト機能
│   │   └── videoPlayer/            # ビデオプレイヤー機能
│   │       ├── analysis/           # 統計分析ロジック
│   │       │   ├── hooks/          # 分析用カスタムフック
│   │       │   └── utils/          # 分析ユーティリティ
│   │       └── components/         # ビデオプレイヤーコンポーネント
│   │           ├── Analytics/      # 統計モーダル
│   │           ├── Controls/       # コントロールパネル
│   │           ├── Player/         # プレイヤー本体
│   │           ├── Setup/          # 初期設定（パッケージ作成）
│   │           └── Timeline/       # タイムライン
│   ├── pages/                      # ページコンポーネント
│   │   ├── settings/               # 設定画面
│   │   ├── videoPlayer/            # ビデオプレイヤーページ
│   │   ├── SettingsPage.tsx        # 設定ページ
│   │   ├── TestVideoPage.tsx       # テストページ
│   │   └── VideoPlayerApp.tsx      # メインページ
│   ├── hooks/                      # 共通カスタムフック
│   │   ├── videoPlayer/            # ビデオプレイヤー用フック
│   │   ├── useGlobalHotkeys.ts     # グローバルホットキー
│   │   ├── useSettings.ts          # 設定管理
│   │   └── useVideoPlayerApp.ts    # アプリ全体の状態管理
│   ├── types/                      # TypeScript型定義
│   ├── utils/                      # ユーティリティ関数
│   ├── contexts/                   # React Context API
│   ├── components/                 # 共通コンポーネント
│   ├── App.tsx                     # Reactアプリルート
│   └── index.tsx                   # エントリーポイント
├── electron/                       # Electronアプリケーション
│   └── src/
│       ├── main.ts                 # メインプロセス
│       ├── preload.ts              # プリロードスクリプト
│       ├── menuBar.ts              # メニューバー定義
│       ├── settingsManager.ts      # 設定永続化
│       ├── settingsWindow.ts       # 設定ウィンドウ
│       ├── playlistWindow.ts       # プレイリストウィンドウ
│       ├── shortCutKey.ts          # グローバルショートカット
│       └── utils.ts                # ユーティリティ
├── public/                         # 静的ファイル
├── build/                          # ビルド出力（gitignore）
├── dist/                           # 配布用ビルド出力（gitignore）
├── docs/                           # ドキュメント
│   ├── architecture.md             # アーキテクチャ詳細
│   ├── audio-sync-offset-specification.md
│   ├── design-system.md
│   ├── sctimeline-implementation.md
│   ├── homebrew-distribution.md
│   └── homebrew-quickstart.md
├── .github/                        # GitHub設定
│   ├── copilot-instructions.md     # Copilot向け開発ガイドライン
│   ├── instructions/               # 言語別指示
│   └── workflows/                  # GitHub Actions
├── package.json                    # npm依存関係
├── tsconfig.json                   # TypeScript設定（React）
├── electron/tsconfig.json          # TypeScript設定（Electron）
└── webpack.config.ts               # Webpack設定
```

### 主要ディレクトリの責務

- **src/features/**: 機能単位で整理。`videoPlayer/`配下に`components/`, `hooks/`, `utils/`, `analysis/`
- **src/pages/**: ページレベルのコンポーネント。各ページ固有のロジックは`hooks/`に配置
- **src/hooks/**: 複数ページで共有するカスタムフック
- **src/types/**: 共通型定義（`TimelineData`, `Settings`, `MetaData`等）
- **electron/src/**: Electronメインプロセス。IPC通信、ファイルI/O、ウィンドウ管理

---

## 開発ワークフロー

このプロジェクトは **Git Flow** を採用しています。詳細は [CONTRIBUTING.md](CONTRIBUTING.md#ブランチ戦略git-flow) を参照してください。

### 開発の基本フロー

1. **リポジトリのクローンとセットアップ**

   ```bash
   git clone https://github.com/Kou-ISK/sportaglytics.git
   cd sportaglytics
   git checkout develop  # 開発ブランチに切り替え
   pnpm install
   ```

2. **作業ブランチの作成**

   ```bash
   git checkout develop
   git pull origin develop  # 最新化
   git checkout -b feature/your-feature-name
   ```

3. **コード実装**
   - [.github/copilot-instructions.md](.github/copilot-instructions.md) のコーディング規約に従う
   - TypeScript strict mode を遵守（`any` は避ける）
   - React 関数コンポーネントのみ使用
   - カスタムフックで副作用を分離

4. **型チェック**

   ```bash
   pnpm exec tsc --noEmit              # React側
   pnpm exec tsc -p electron --noEmit  # Electron側
   ```

5. **動作確認**

   ```bash
   pnpm run electron:dev
   ```

6. **コミット**

   ```bash
   git add .
   git commit -m "feat: 新機能の説明"
   ```

   コミットメッセージ形式（推奨）:
   - `feat:` 新機能
   - `fix:` バグ修正
   - `docs:` ドキュメント更新
   - `refactor:` リファクタリング
   - `test:` テスト追加
   - `chore:` その他雑務

7. **Pull Request 作成**
   - **ベースブランチ: `develop`** を設定
   - GitHub で PR を作成
   - テンプレートに従ってチェックリストを確認
   - レビュー後に `develop` にマージ

### リリースフロー（メンテナのみ）

1. `develop` の内容をテスト・検証
2. `package.json` のバージョンを更新
3. `develop` → `main` へのプルリクエスト
4. マージ後、タグを作成してプッシュ
5. GitHub Actions が自動ビルド・リリース作成

### 新機能開発

**注意**: 上記の「開発の基本フロー」に従って `develop` ブランチから作業を開始してください。

以下は個別の手順詳細です：

1. **ブランチ作成**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **コード実装**
   - コーディング規約は上記参照

3. **型チェック**

   ```bash
   pnpm exec tsc --noEmit              # React側
   pnpm exec tsc -p electron --noEmit  # Electron側
   ```

4. **動作確認**

   ```bash
   pnpm run electron:dev
   ```

5. **コミット・Push・PR作成**
   - 上記の基本フロー参照
   - **必ず `develop` へのPRを作成**

### バグ修正

1. **Issue 作成**（未作成の場合）
2. **修正ブランチ作成**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b fix/issue-123-bug-description
   ```

3. **修正・テスト・PR作成**（上記と同様）

---

## デバッグ

### React DevTools

開発モード（`pnpm run electron:dev`）では、Electronウィンドウ内でReact DevToolsが利用可能です。

```bash
# Electronウィンドウ内で
Cmd+Option+I (macOS) / Ctrl+Shift+I (Windows/Linux)
```

「Components」タブでReactコンポーネントツリーを確認できます。

### Electron DevTools

メインプロセスのデバッグ:

1. `electron/src/main.ts`にブレークポイントを設定
2. VSCodeの「実行とデバッグ」から「Electron: Main」を起動

レンダラープロセスのデバッグ:

```bash
# ウィンドウ内で開発者ツールを開く
Cmd+Option+I (macOS) / Ctrl+Shift+I (Windows/Linux)
```

### ログ出力

- **console.log**: 開発者ツールのコンソールに出力
- **Electronログ**: `electron/src/main.ts`で`console.log`はターミナルに出力

### 音声同期デバッグ

`src/utils/AudioSyncAnalyzer.ts`に詳細ログが組み込まれています。デバッグモードを有効化:

```typescript
// AudioSyncAnalyzer.ts内
const DEBUG = true; // デフォルトはfalse
```

詳細は[docs/audio-sync-offset-specification.md](docs/audio-sync-offset-specification.md#トラブルシューティング)参照。

---

## ビルドとテスト

### ローカルビルド

```bash
# Reactアプリのビルド
pnpm run build

# Electronアプリとして起動
pnpm run electron:start
```

### 配布用ビルド

```bash
pnpm run electron:build
```

出力:

- macOS: `dist/SporTagLytics-{version}.dmg`
- Windows: `dist/SporTagLytics-{version}.exe` (未検証)

### 型チェック（CI/CD前に実行推奨）

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron --noEmit
```

型エラーがある場合はビルドが失敗します。

### テスト（今後実装予定）

現在、ユニットテストやE2Eテストは未整備です。[TESTING.md](TESTING.md)参照。

---

## 推奨IDE設定

### VSCode拡張機能

以下の拡張機能をインストールすることを推奨します:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.workingDirectories": [{ "mode": "auto" }]
}
```

### デバッグ設定 (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "protocol": "inspector",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": [
        "${workspaceFolder}/electron/src/main.ts",
        "--remote-debugging-port=9223"
      ],
      "preLaunchTask": "npm: build"
    }
  ]
}
```

---

## よくある問題

開発中によくある問題の解決方法は[TROUBLESHOOTING.md](TROUBLESHOOTING.md)を参照してください。

---

## 次のステップ

- [ARCHITECTURE.md](ARCHITECTURE.md): システム設計の詳細
- [CONTRIBUTING.md](CONTRIBUTING.md): 貢献ガイドライン
- [.github/copilot-instructions.md](.github/copilot-instructions.md): コーディング規約
