# Homebrew配布 クイックスタートガイド

バージョン更新・公開後の復旧は[Release手順](../.github/RELEASE.md)に従います。同じバージョンのDMGを差し替えず、新しいバージョンを発行します。

このガイドでは、SporTagLyticsをHomebrewで**完全自動配布**する最小限の手順を説明します。

## 📋 必要なもの

- [ ] GitHubアカウント
- [ ] sportaglyticsリポジトリへの管理者権限
- [ ] 5分程度の作業時間（初回のみ）

## 🚀 初回セットアップ（3ステップ）

### ステップ1: Homebrew Tapリポジトリを作成

1. https://github.com/new にアクセス
2. 以下の設定でリポジトリを作成:
   - Repository name: `homebrew-tap`
   - Public にチェック
   - "Create repository" をクリック

**初期化は不要です。GitHub Actionsが自動的に作成します。**

### ステップ2: GitHub Tokenを作成

1. https://github.com/settings/tokens にアクセス
2. "Generate new token (classic)" をクリック
3. Note: `Homebrew Tap Auto Update`
4. Expiration: `1 year`
5. 権限を選択:
   - ✅ `repo` (すべてにチェック)
6. "Generate token" をクリック
7. **トークンをコピー**（この画面でしか表示されません！）

### ステップ3: GitHub Secretsに登録

1. https://github.com/Kou-ISK/sportaglytics/settings/secrets/actions にアクセス
2. "New repository secret" をクリック
3. 以下を入力:
   - Name: `HOMEBREW_TAP_TOKEN`
   - Secret: 上記でコピーしたトークンを貼り付け
4. "Add secret" をクリック

## ✅ セットアップ完了！

候補の検証・レビューを完了した後、タグpushでWindowsとmacOSの配布、Homebrew更新を起動します。0.17.4は第三者告知と対応source配布を含む修正版です。既存の配布物を置換せず、新版として公開します。公開されたDMGとSHA256を確認してからTapへ反映します。

## 📦 リリース手順

```bash
# 1. develop最新からrelease作業ブランチを作成してバージョンを更新
git checkout develop
git pull --ff-only origin develop
git checkout -b release/prepare-<version-with-hyphens>
vim package.json  # "version": "<version>" に変更

# 2. 作業ブランチからdevelopへのDraft PRで候補を検証
git add package.json CHANGELOG.md README.md docs .github/RELEASE.md
git commit -m "chore(release): prepare <version>"
git push -u origin HEAD
gh pr create --draft --base develop --title "chore(release): prepare <version>" --body-file <candidate-review-file>

# audit / 品質ゲート / Windows CI / macOS検証とレビューを通し、developへ統合
gh pr create --base main --head develop --title "Release v<version>" --body "Release v<version>"

# CI / レビュー / branch protection 通過後
gh pr merge --merge

git checkout main
git pull --ff-only origin main

# 3. main の PR merge commit にタグをプッシュ
git tag v<version>
git push origin v<version>
```

タグpush後、以下が順に実行されます。所要時間は検証と公証の状況によって変わります。同じReleaseを手動dispatchしません。dry-runやdraft公開のモードはありません。

- ✅ Windowsのnative依存・Electron E2E・NSIS・インストール後のE2E
- ✅ macOSのaudit・品質ゲート・Electron E2E・署名と公証（Intel & Apple Silicon）
- ✅ GitHubリリースの作成
- ✅ SHA256ハッシュの計算
- ✅ **Homebrew Tapの自動更新** ⭐

## 🧪 動作確認

```bash
# ユーザーのインストール方法
brew tap Kou-ISK/tap
brew install --cask sportaglytics

# 起動確認
open -a "SporTagLytics"
```

公開後は両DMG・Windowsインストーラー・`SHA256SUMS.txt`とHomebrewのURL・SHA256を確認します。[確認項目](../.github/RELEASE.md#post-release-verification)。

## 📚 詳細情報

より詳しい情報は [homebrew-distribution.md](./homebrew-distribution.md) を参照してください。

## ❓ トラブルシューティング

### GitHub Actionsが失敗する

1. https://github.com/Kou-ISK/sportaglytics/actions で失敗したワークフローをクリック
2. エラーメッセージを確認
3. よくある原因:
   - `HOMEBREW_TAP_TOKEN`が設定されていない
   - トークンの権限が不足している
   - homebrew-tapリポジトリが存在しない

### インストールできない

```bash
# Homebrewを最新化
brew update

# Tapを再取得
brew untap Kou-ISK/tap
brew tap Kou-ISK/tap
brew install --cask sportaglytics
```

### ビルドが失敗する

```bash
# ローカルでテスト
pnpm install
pnpm run build
pnpm run electron:package:mac
```

ソース修正が必要なら、新しいバージョンで候補準備をやり直してください。既存のタグや公開artifactは差し替えません。
