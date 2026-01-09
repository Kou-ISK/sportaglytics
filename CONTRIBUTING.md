# コントリビューションガイド

SporTagLytics へのコントリビューションに興味を持っていただき、ありがとうございます！このドキュメントは、プロジェクトへの貢献方法についてのガイドラインを提供します。

## 目次

- [行動規範](#行動規範)
- [はじめに](#はじめに)
- [開発ワークフロー](#開発ワークフロー)
- [コーディング規約](#コーディング規約)
- [変更の提出](#変更の提出)
- [Issue の報告](#issue-の報告)

## 行動規範

このプロジェクトは [Contributor Covenant 行動規範](CODE_OF_CONDUCT.md) に準拠しています。参加する際は、この規範を遵守することが求められます。

## はじめに

### 前提条件

開発を始める前に、以下がインストールされていることを確認してください：

- **Node.js**: 18.0.0 以上
- **pnpm**: 9.0.0 以上（必須のパッケージマネージャー）
- **Git**: バージョン管理用

### インストール

1. GitHub でリポジトリをフォーク
2. フォークをローカルにクローン：
   ```bash
   git clone https://github.com/YOUR_USERNAME/sportaglytics.git
   cd sportaglytics
   ```
3. 依存関係をインストール：
   ```bash
   pnpm install
   ```
4. 開発サーバーを起動：
   ```bash
   pnpm start
   ```

詳細なセットアップ手順は [DEVELOPMENT.md](DEVELOPMENT.md) を参照してください。

## 開発ワークフロー

### ブランチの作成

作業用の新しいブランチを作成：

```bash
git checkout -b feature/your-feature-name
# または
git checkout -b fix/your-bug-fix
```

ブランチ命名規則：

- `feature/` - 新機能
- `fix/` - バグ修正
- `docs/` - ドキュメント変更
- `refactor/` - コードリファクタリング
- `test/` - テスト追加または変更

### 変更の実施

1. [コーディング規約](#コーディング規約) に従って変更を加える
2. 変更を十分にテストする
3. 型チェックを実行：
   ```bash
   pnpm exec tsc --noEmit
   ```
4. ESLint エラーがないことを確認（未使用変数はビルド失敗の原因になります）

### 変更のコミット

以下の形式で明確で簡潔なコミットメッセージを書いてください：

```
<type>: <短い要約>

<オプション：詳細な説明>

<オプション：フッター>
```

タイプ：

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: コードスタイル変更（フォーマットなど）
- `refactor`: コードリファクタリング
- `test`: テスト追加または変更
- `chore`: ビルドプロセスや補助ツールの変更

例：

```
feat: カスタムコードレイアウト機能を追加

コードパネルのドラッグ&ドロップレイアウトカスタマイズを実装。
グループ化、リサイズ、ボタンリンクをサポート。

Closes #123
```

## コーディング規約

このプロジェクトは厳格な TypeScript と React のベストプラクティスに従います。**すべてのコントリビューションは [.github/copilot-instructions.md](.github/copilot-instructions.md) のガイドラインに準拠する必要があります。**

### 主要原則

- **TypeScript**: 常に strict mode を使用；`any` は避ける（やむを得ない場合は TODO を追加）
- **React**: 関数コンポーネントのみ使用（React 18）
- **命名規則**:
  - PascalCase: React コンポーネント、コンポーネントディレクトリ
  - camelCase: ユーティリティ関数、フック、サービスモジュール
  - カスタムフック: `useXxx.ts` 形式
- **ファイル構成**:
  - 機能ベース構造: `src/features/<FeatureName>/`
  - 責務の分離: `components/`, `hooks/`, `utils/`, `types/`
  - View と Logic の分離: JSX は `view/`、ロジックは `hooks/`
- **スタイリング**: Material UI を `sx` プロパティで使用
- **フック**: 常に完全な依存配列とクリーンアップ関数を含める

### 追加ガイドライン

1. **TypeScript 固有**:
   - [.github/instructions/typescript.instructions.md](.github/instructions/typescript.instructions.md) を参照
2. **React/TSX 固有**:
   - [.github/instructions/tsx.instructions.md](.github/instructions/tsx.instructions.md) を参照

3. **Electron 統合**:
   - IPC 呼び出しには常に `window.electronAPI` を使用
   - Electron ロジックは `src/services/electron/` に配置
   - `contextIsolation: true` を維持

4. **パフォーマンス**:
   - 高コストな計算には `useMemo` / `useCallback` を使用
   - 既存の共有フック（例: `useTimelineViewport`, `useMatrixAxes`）を再利用

## 変更の提出

### プルリクエストプロセス

1. **ドキュメントの更新**: 関連ドキュメントが更新されていることを確認
2. **変更のテスト**: 手動および型チェックで機能を検証
3. **フォークにプッシュ**:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **プルリクエストを作成**:
   - GitHub の元のリポジトリにアクセス
   - "New Pull Request" をクリック
   - ブランチを選択
   - PR テンプレートに以下を記入：
     - 変更内容の明確な説明
     - 関連 Issue 番号（例: "Closes #123"）
     - 実施したテスト
     - UI 変更がある場合はスクリーンショット/動画

5. **コードレビュー**: レビュアーのフィードバックに迅速に対応
6. **マージ**: 承認されると、メンテナーが PR をマージします

### プルリクエストガイドライン

- PR は焦点を絞り、アトミック（1つの機能/修正につき1つの PR）に保つ
- 新機能を追加する場合はテストを含める
- ユーザー向け変更の場合は CHANGELOG.md を更新
- すべての CI チェックが通過することを確認
- レビューコメントには 48 時間以内に返信

## Issue の報告

### バグレポート

バグを報告する際は、以下を含めてください：

1. **説明**: バグの明確で簡潔な説明
2. **再現手順**:
   ```
   1. '...' にアクセス
   2. '...' をクリック
   3. '...' までスクロール
   4. エラーを確認
   ```
3. **期待される動作**: 本来どうあるべきか
4. **実際の動作**: 実際に何が起こるか
5. **環境**:
   - OS: (例: macOS 14.2)
   - アプリバージョン: (例: 0.2.2)
   - インストール方法: (例: Homebrew, DMG)
6. **ログ**: 関連するコンソール/エラーログ
7. **スクリーンショット/動画**: 該当する場合

### 機能リクエスト

機能をリクエストする際は、以下を含めてください：

1. **ユースケース**: 解決しようとしている問題の説明
2. **提案する解決策**: あなたの提案するアプローチ
3. **代替案**: 検討した他の解決策
4. **追加のコンテキスト**: その他の関連情報

### Issue ラベル

以下のラベルを使用します：

- `bug`: 何かが動作していない
- `enhancement`: 新機能またはリクエスト
- `documentation`: ドキュメントの改善
- `good first issue`: 初心者に適している
- `help wanted`: 特別な注意が必要
- `question`: さらなる情報が要求される

## ヘルプの入手

- **ドキュメント**: 詳細なガイドは [docs/](docs/) を確認
- **トラブルシューティング**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照
- **アーキテクチャ**: [ARCHITECTURE.md](ARCHITECTURE.md) を参照
- **ディスカッション**: 質問には GitHub Discussions を使用

## ライセンス

コントリビューションにより、あなたの貢献が [MIT ライセンス](LICENSE) の下でライセンスされることに同意したものとみなされます。

---

SporTagLytics へのコントリビューションありがとうございます！🎉
