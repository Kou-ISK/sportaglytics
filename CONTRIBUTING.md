# Contributing to SporTagLytics

SporTagLyticsへのコントリビューションに興味を持っていただき、ありがとうございます！このドキュメントでは、プロジェクトに貢献する方法をご案内します。

## 目次

- [最初の貢献](#最初の貢献)
- [行動規範](#行動規範)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [プルリクエストの流れ](#プルリクエストの流れ)
- [コーディング規約](#コーディング規約)
- [AI contributor 向けルール](#ai-contributor-向けルール)
- [ドキュメント更新](#ドキュメント更新)
- [コミットメッセージ](#コミットメッセージ)
- [バグレポート](#バグレポート)
- [機能リクエスト](#機能リクエスト)

## 最初の貢献

アプリのインストール版だけでも、[合成サンプル](docs/quickstart.md)の手順確認、不具合の再現、文書の修正から参加できます。実試合映像、私有パッケージ、GGUF、イベント検出モデルを提供する必要はありません。

以下は着手しやすい作業例です。募集中のIssueや担当者が存在するという意味ではないため、まず[既存IssueとPR](https://github.com/Kou-ISK/sportaglytics/issues)で重複を確認してください。

| 小さな作業                                     | 提出する根拠・完了条件                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| クイックスタートをmacOSまたはWindowsで順に試す | アプリ版・OS/CPU・導入方法と、止まった手順・期待結果を記録。新規利用者の理解と、自動試験の成功を区別する    |
| 文書のボタン名・リンクを1か所直す              | 現行画面またはsourceの対応箇所を示し、関連する入口も確認。既存の合成画像を使うか、架空データで再撮影する    |
| キーボード操作を1つの画面で確認する            | Tab/Shift+Tab/Enter/Escでフォーカスと操作結果を記録。読上げソフトを使っていなければ、その動作は未検証とする |
| 既存の不具合へ最小の回帰例を追加する           | 失敗する入力と期待結果を1つに絞り、修正前の失敗・修正後の成功を示す。既存testの単なる複写を増やさない       |

誤字・リンク修正や再現報告は直接PR/Issueにできます。動作変更、新機能、大きな再構成は先にIssueで目的と受入条件を共有します。質問は[Discussions](https://github.com/Kou-ISK/sportaglytics/discussions)、脆弱性は[非公開の報告手順](SECURITY.md)へ進んでください。

sourceを変更する場合の最初の確認は `git diff --check` と変更対象の検査です。PR前には[共通ゲートと変更別の追加検証](docs/testing.md#required-quality-gate)を実行し、環境制約で未実施のものは理由を残します。文書だけの修正でも、リンク先・現行操作・公開してよい内容をレビューしてください。

## 行動規範

このプロジェクトでは、すべての貢献者が互いに尊重し合い、建設的なコミュニケーションを行うことを期待しています。詳細は [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を参照してください。

## 開発環境のセットアップ

詳細は [開発者ガイド](docs/development.md) を参照してください。テストと品質ゲートの判断は [docs/testing.md](docs/testing.md) を参照してください。

### 必要な環境

- Node.js 22.12.0以上
- pnpm 9.1.0（`package.json` の `packageManager` に固定）
- Git

### セットアップ手順

```bash
# リポジトリをフォーク後、クローン
git clone https://github.com/YOUR_USERNAME/sportaglytics.git
cd sportaglytics

# pnpmのインストール（未インストールの場合）
npm install -g pnpm@9.1.0

# 依存関係のインストール
pnpm install --frozen-lockfile

# 開発サーバー起動
pnpm run electron:dev
```

## プルリクエストの流れ

1. **変更範囲の確認**
   - 動作変更や新機能は、関連するIssueで目的と受入条件を共有してください
   - 既存のIssue/PRがある場合は重複を避けます。小さな文書修正は直接PRにできます

2. **ブランチの作成**

   `upstream` を `https://github.com/Kou-ISK/sportaglytics.git` に設定したforkでは、最新の `upstream/develop` から作成します。

   ```bash
   git fetch upstream develop
   git switch -c feature/your-feature-name upstream/develop
   # または
   git switch -c fix/bug-description upstream/develop
   ```

3. **変更の実装**
   - コーディング規約に従って実装
   - 必要に応じてテストを追加
   - ユーザー影響または設計変更がある場合はドキュメントを更新
   - [共通ゲートと変更対象ごとの追加検証](docs/testing.md#required-quality-gate)を実行し、結果・未実施範囲を記録

4. **コミット**
   - 意味のある単位でコミット
   - [コミットメッセージ規約](#コミットメッセージ)に従う

5. **プッシュとPR作成**

   ```bash
   git push origin feature/your-feature-name
   ```

   - GitHub上で `Kou-ISK/sportaglytics` の `develop` 宛てにプルリクエストを作成
   - テンプレートに従って説明を記入

6. **レビュー対応**
   - レビュアーからのフィードバックに対応
   - 必要に応じて修正を追加コミット

## コーディング規約

実装規約の正本は [AGENTS.md](AGENTS.md) です。この節は contributor 向けの要約です。規約が重なる場合は `AGENTS.md` を優先してください。

### TypeScript

- **strict mode**: 常に有効
- **any の禁止**: やむを得ない場合のみ使用し、理由コメントを添える
- **型定義**: feature固有型はfeature内、共有型は `src/types/` または `src/shared/` に配置
- **命名規則**:
  - React コンポーネント: PascalCase
  - 関数・変数: camelCase
  - カスタムフック: `useXxx` 形式
  - 定数: UPPER_SNAKE_CASE

### React

- **関数コンポーネントのみ**: クラスコンポーネントは使用しない
- **Hooks**:
  - `useEffect` には完全な依存配列を定義し、必要なクリーンアップを実装
  - 複雑なロジックはカスタムフックに分離
- **責務分離**: ビュー（JSX）とロジック（Hooks）を明確に分離

### ディレクトリ構造

```
src/
├── features/           # 機能単位
│   └── <FeatureName>/
│       ├── components/ # UIコンポーネント
│       ├── hooks/      # カスタムフック
│       └── utils/      # ユーティリティ
├── pages/              # ページコンポーネント
├── hooks/              # 共通フック
├── types/              # 型定義
├── utils/              # 共通ユーティリティ
├── contexts/           # Context API
└── components/         # 共通コンポーネント
```

現行の詳細構造は [docs/system-overview.md](docs/system-overview.md) と [docs/development.md](docs/development.md) を参照してください。

### スタイリング

- **Material-UI**: `sx` プロパティで統一
- **テーマ**: [design system](docs/design-system.md) と `src/design-system` のsemantic tokenを正本とする
- **ハードコード禁止**: 色・余白は必ずテーマ経由で取得

### Linting & Formatting

```bash
# Lint実行
pnpm run lint

# 自動修正
pnpm run fix

# Format実行
pnpm run format
```

## AI contributor 向けルール

AI agent / Copilot で変更する場合も、提出者が内容をレビューし責任を持ちます。

- 最初に [AGENTS.md](AGENTS.md) を読む。
- Copilot の場合は [.github/copilot-instructions.md](.github/copilot-instructions.md) と `.github/instructions/*.instructions.md` を適用する。
- 設計判断を変更する場合は [docs/adr/README.md](docs/adr/README.md) を確認し、必要に応じて ADR を追加・更新する。
- ADR を追加・更新する場合は [ADR Operations](docs/documentation-guide.md#adr-operations) に従い、採番・命名・状態変更・一覧更新を同じ PR で行い、`pnpm run check:adr` を実行する。
- 新規ファイルの配置に迷う場合は [docs/project-structure.md](docs/project-structure.md) を確認する。
- 仕様・設計・ユーザー影響・開発手順・配置判断が変わる場合は [docs/documentation-guide.md](docs/documentation-guide.md) の Docs Impact Matrix に従って docs を同時更新する。
- ドキュメントを追加する場合は [docs/README.md](docs/README.md) に掲載する。
- ブランチ名とコミットメッセージは [AGENTS.md](AGENTS.md) の Git / ブランチ / コミット運用に従う。
- AI生成部分も [Testing](docs/testing.md#required-quality-gate) に従って検証し、実行環境・コマンド・結果・未実施範囲をPRに記載する。
- 提出者が差分と失敗経路、引用・流用資産の出典/許諾、非公開情報の不在を確認する。AIの自己申告やテスト成功を権利確認の代わりにしない。
- [由来の確認台帳](docs/provenance-review.md) の未確認項目へ根拠を追加する場合も、契約原本、会話ログ、私有モデル情報を公開PRに添付しない。再現用fixtureは架空名と相対パスを使う。

## ドキュメント更新

ドキュメント運用の詳細は [docs/documentation-guide.md](docs/documentation-guide.md) を参照してください。

- PR では Docs Impact Matrix を確認し、docs 更新不要の場合も理由を記載する。
- ユーザー影響がある変更は `docs/user-guide.md` または関連機能 docs を更新する。
- アーキテクチャ変更は `docs/system-overview.md` と `docs/adr/` を確認する。
- ADR を追加・更新した場合は `docs/adr/README.md` の一覧も更新する。
- ディレクトリ構成や配置判断の変更は `docs/project-structure.md` を更新する。
- 開発手順や品質ゲートの変更は `docs/development.md` を更新する。
- 新規 docs は `docs/README.md` から辿れるようにする。

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) 形式を使います。AI agent は [AGENTS.md](AGENTS.md) の Git / ブランチ / コミット運用を正本として扱います。

### フォーマット

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの動作に影響しない変更（フォーマット、セミコロンなど）
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

### 例

```
feat(playlist): プレイリスト専用ウィンドウを追加

- 連続/ループ再生機能を実装
- フリーズフレーム機能を追加
- 簡易描画機能を実装

Closes #123
```

## バグレポート

バグを発見した場合は、以下の情報を含めて Issue を作成してください：

- **環境**:
  - OSの版とCPU: macOS / Windows（Linux source buildの場合はその旨）
  - SporTagLyticsの版と導入方法: Homebrew / Release asset / source build
  - Node.js / pnpmの版はsource buildの場合のみ
- **再現手順**: 具体的なステップ
- **期待される動作**: 本来どうあるべきか
- **実際の動作**: 何が起こったか
- **スクリーンショット**: 可能であれば添付
- **エラーログ**: 関係するエラーメッセージだけ

公開前に[データ取り扱い](docs/privacy-and-data-handling.md#sharing-and-issue-reports)を確認してください。ログ・画面・パッケージ名から実チーム/試合名、顔、アカウント、ローカル絶対パス、秘密情報を除きます。実動画や私有パッケージを添付せず、合成サンプルと架空名・相対パスで再現してください。脆弱性の詳細はpublic Issueへ書きません。

## 機能リクエスト

新機能の提案は大歓迎です！以下の情報を含めて Issue を作成してください：

- **背景**: なぜこの機能が必要か
- **提案内容**: どのような機能か
- **ユースケース**: どのように使うか
- **代替案**: 他に考えられる実装方法

## 質問・サポート

- **質問**: [GitHub Discussions](https://github.com/Kou-ISK/sportaglytics/discussions) を利用してください
- **バグ・機能リクエスト**: [GitHub Issues](https://github.com/Kou-ISK/sportaglytics/issues) を利用してください
- **セキュリティ**: セキュリティ上の問題は Issue ではなく、[SECURITY.md](SECURITY.md) の手順で報告してください

## ライセンス

コントリビューションを提出することで、あなたの貢献が [MIT License](LICENSE) の下でライセンスされることに同意したものとみなされます。
