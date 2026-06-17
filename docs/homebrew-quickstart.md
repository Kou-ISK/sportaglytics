# Homebrew配布 クイックスタートガイド

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

以降は**タグをプッシュするだけ**で全て自動化されます。

## 📦 リリース手順（超シンプル）

```bash
# 1. バージョンを更新（例: 0.2.6）
vim package.json  # "version": "<version>" に変更

# 2. develop へコミットして main へ PR で統合
git add package.json CHANGELOG.md
git commit -m "chore: bump version to <version>"
git push origin develop

gh pr create --base main --head develop --title "Release v<version>" --body "Release v<version>"

# CI / レビュー / branch protection 通過後
gh pr merge --merge

git checkout main
git pull --ff-only origin main

# 3. main の PR merge commit にタグをプッシュ
git tag v<version>
git push origin v<version>
```

**これだけで完了！** 5-10分後、以下が自動実行されます:

- ✅ アプリのビルド（Intel & Apple Silicon）
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

# homebrew/sportaglytics.rb を更新

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

エラーが出たら修正してから再度タグをプッシュしてください。
