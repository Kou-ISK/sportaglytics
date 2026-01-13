# Contributing to SporTagLytics

SporTagLyticsへのコントリビューションに興味を持っていただき、ありがとうございます！このドキュメントでは、プロジェクトに貢献する方法をご案内します。

## 目次

- [行動規範](#行動規範)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [プルリクエストの流れ](#プルリクエストの流れ)
- [コーディング規約](#コーディング規約)
- [コミットメッセージ](#コミットメッセージ)
- [バグレポート](#バグレポート)
- [機能リクエスト](#機能リクエスト)

## 行動規範

このプロジェクトでは、すべての貢献者が互いに尊重し合い、建設的なコミュニケーションを行うことを期待しています。ハラスメントや攻撃的な行為は一切容認されません。

## 開発環境のセットアップ

詳細は [開発者ガイド](docs/development.md) を参照してください。

### 必要な環境

- Node.js 18.0.0以上
- pnpm 9.0.0以上
- Git

### セットアップ手順

```bash
# リポジトリをフォーク後、クローン
git clone https://github.com/YOUR_USERNAME/sportaglytics.git
cd sportaglytics

# pnpmのインストール（未インストールの場合）
npm install -g pnpm

# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm run electron:dev
```

## プルリクエストの流れ

1. **Issue の作成**
   - バグ修正や新機能の実装前に、関連する Issue を作成してください
   - 既存の Issue がある場合は、そちらにコメントしてください

2. **ブランチの作成**

   ```bash
   git checkout -b feature/your-feature-name
   # または
   git checkout -b fix/bug-description
   ```

3. **変更の実装**
   - コーディング規約に従って実装
   - 必要に応じてテストを追加
   - 型チェックを実行: `pnpm exec tsc --noEmit`

4. **コミット**
   - 意味のある単位でコミット
   - [コミットメッセージ規約](#コミットメッセージ)に従う

5. **プッシュとPR作成**

   ```bash
   git push origin feature/your-feature-name
   ```

   - GitHub上でプルリクエストを作成
   - テンプレートに従って説明を記入

6. **レビュー対応**
   - レビュアーからのフィードバックに対応
   - 必要に応じて修正を追加コミット

## コーディング規約

### TypeScript

- **strict mode**: 常に有効
- **any の禁止**: やむを得ない場合のみ使用し、TODO コメントを添える
- **型定義**: `src/types/` に集約
- **命名規則**:
  - React コンポーネント: PascalCase
  - 関数・変数: camelCase
  - カスタムフック: `useXxx` 形式
  - 定数: UPPER_SNAKE_CASE

### React

- **関数コンポーネントのみ**: クラスコンポーネントは使用しない
- **Hooks**:
  - `useEffect` には完全な依存配列とクリーンアップを必ず定義
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

### スタイリング

- **Material-UI**: `sx` プロパティで統一
- **テーマ**: `src/theme.ts` をソースオブトゥルースとする
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

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) 形式を推奨します。

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
  - OS: macOS / Windows / Linux
  - バージョン: 0.x.x
  - Node.js バージョン
- **再現手順**: 具体的なステップ
- **期待される動作**: 本来どうあるべきか
- **実際の動作**: 何が起こったか
- **スクリーンショット**: 可能であれば添付
- **エラーログ**: コンソールのエラーメッセージ

## 機能リクエスト

新機能の提案は大歓迎です！以下の情報を含めて Issue を作成してください：

- **背景**: なぜこの機能が必要か
- **提案内容**: どのような機能か
- **ユースケース**: どのように使うか
- **代替案**: 他に考えられる実装方法

## 質問・サポート

- **質問**: GitHub Discussions を利用してください
- **バグ・機能リクエスト**: GitHub Issues を利用してください
- **セキュリティ**: セキュリティ上の問題は Issue ではなく、直接メンテナに連絡してください

## ライセンス

コントリビューションを提出することで、あなたの貢献が [MIT License](LICENSE) の下でライセンスされることに同意したものとみなされます。

---

ご協力ありがとうございます！🎉
