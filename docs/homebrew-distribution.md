# Homebrew配布ガイド（完全自動化版）

バージョン更新・公開後の復旧は[Release手順](../.github/RELEASE.md)に従います。同じバージョンのDMGを差し替えず、新しいバージョンを発行します。

macOS署名で停止した場合は[署名の切り分け](../.github/RELEASE.md#macos-signing-keychain-unlock-failed)を確認し、署名・公証を完了したDMGだけをTapへ反映します。

このドキュメントでは、SporTagLyticsをHomebrew Caskで**完全自動配布**するための手順を説明します。リリース全体の正本は [.github/RELEASE.md](../.github/RELEASE.md) です。

HomebrewのCPU識別名をURLへ直接埋め込みません。Caskの `arch arm: "arm64", intel: "x64"` でDMG名へ対応付け、`#{arch}` をURLで使用します。公開後は両アーキテクチャのURLとSHA256を確認します。

## 配布方式

### 採用: 別Tapリポジトリ + 完全自動化

✅ **メリット**:

- ユーザーが簡単にインストール可能（`brew tap` + `brew install`）
- バージョン管理が自動化
- SHA256ハッシュも自動更新

❌ **デメリット**:

- 初回セットアップに別リポジトリとトークンが必要（1回のみ）

```bash
# ユーザーのインストール方法（シンプル！）
brew tap Kou-ISK/tap
brew install --cask sportaglytics
```

## 初回セットアップ手順

### 1. Homebrew Tapリポジトリの作成

1. https://github.com/new にアクセス
2. 以下の設定でリポジトリを作成:
   - Repository name: `homebrew-tap`
   - Public にチェック
   - "Create repository" をクリック

初期化は不要です。GitHub Actionsが自動的に作成します。

### 2. GitHub Personal Access Tokenの作成

1. https://github.com/settings/tokens にアクセス
2. "Generate new token (classic)" をクリック
3. Note: `Homebrew Tap Auto Update`
4. Expiration: `1 year` または `No expiration`
5. 権限を選択:
   - ✅ `repo` (すべてにチェック)
6. "Generate token" をクリック
7. **トークンをコピー**（この画面でしか表示されません！）

### 3. GitHub Secretsに登録

1. https://github.com/Kou-ISK/sportaglytics/settings/secrets/actions にアクセス
2. "New repository secret" をクリック
3. 以下を入力:
   - Name: `HOMEBREW_TAP_TOKEN`
   - Secret: 上記でコピーしたトークンを貼り付け
4. "Add secret" をクリック

## リリース手順（完全自動化）

候補の検証とレビューを完了し、`develop`から`main`へのPRを統合した後、タグpushで配布を開始します。0.17.2はタグのみで配布せず、修正版を0.17.3とします。公開されたDMGとSHA256を確認してからTapへ反映します。

### 1. バージョン番号を更新

```bash
# develop最新からrelease作業ブランチを作成してversionを更新
git checkout develop
git pull --ff-only origin develop
git checkout -b release/prepare-<version-with-hyphens>
vim package.json  # "version": "<version>" に変更
```

### 2. 作業ブランチから develop、develop から main へ PR で統合

```bash
git add package.json CHANGELOG.md README.md docs .github/RELEASE.md
git commit -m "chore(release): prepare <version>"
git push -u origin HEAD
gh pr create --draft --base develop --title "chore(release): prepare <version>" --body-file <candidate-review-file>

# 候補のaudit / 品質ゲート / Windows CI / macOS検証とレビューを通し、developへ統合
gh pr create --base main --head develop --title "Release v<version>" --body "Release v<version>"

# CI / レビュー / branch protection 通過後
gh pr merge --merge

git checkout main
git pull --ff-only origin main
```

### 3. タグプッシュ

```bash
# main の PR merge commit にタグをプッシュ（これで自動化開始！）
git tag v<version>
git push origin v<version>
```

### 4. 自動実行される処理

GitHub Actionsが以下を順に実行します。所要時間はWindows検証、ビルド、公証の状況によって変わります。タグpush後に同じReleaseを手動dispatchしません。dry-runやdraft公開のモードはありません。

```
1. Windows検証
   ├─ native依存と品質ゲート、Electron E2E
   └─ NSIS生成とインストール後のE2E

2. macOS検証とビルド
   ├─ audit / 品質ゲート / build / Electron E2E
   └─ Intel & Apple Siliconの署名・公証済みDMGを生成

3. SHA256ハッシュの計算
   └─ 両DMGとWindowsインストーラーのSHA256を計算

4. GitHubリリースの作成
   └─ 両DMG、Windowsインストーラー、SHA256SUMS.txtを公開

5. Homebrew Tapの自動更新 ⭐
   ├─ homebrew-tapリポジトリをクローン
   ├─ Cask formulaを新バージョン・SHA256で生成
   ├─ 自動コミット
   └─ 自動プッシュ
```

### 5. 完了確認

- Releaseページを確認: https://github.com/Kou-ISK/sportaglytics/releases
- Homebrew Tapが自動更新されたことを確認: https://github.com/Kou-ISK/homebrew-tap

### 6. ユーザーが更新可能に

```bash
brew upgrade --cask sportaglytics
```

公開後はReleaseの全artifact、Homebrewの両アーキテクチャのURLとSHA256、インストールと起動を確認します。

## ユーザーのインストール方法

```bash
# 初回のみTapを追加
brew tap Kou-ISK/tap

# インストール
brew install --cask sportaglytics

# アップデート
brew upgrade --cask sportaglytics

# アンインストール
brew uninstall --cask sportaglytics
```

## トラブルシューティング

### GitHub Actionsが失敗する

**Homebrew Tap更新エラー:**

- `HOMEBREW_TAP_TOKEN`が正しく設定されているか確認
- トークンに`repo`権限があるか確認
- homebrew-tapリポジトリが存在するか確認

**ビルドエラー:**

- ログを確認: Actions → 失敗したワークフロー → 該当ステップ
- ローカルでテスト: `pnpm run electron:package:mac`

### インストール時にエラー

```bash
# Homebrewを最新化
brew update

# キャッシュクリア
brew cleanup

# Tapを再取得
brew untap Kou-ISK/tap
brew tap Kou-ISK/tap
brew install --cask sportaglytics
```

### macOS Gatekeeperエラー

初回起動時に「開発元を確認できません」と表示される場合：

1. システム設定 → プライバシーとセキュリティ
2. "このまま開く" をクリック

### Personal Access Tokenの更新

トークンの有効期限が切れた場合：

1. 新しいトークンを生成
2. リポジトリのSecrets設定で`HOMEBREW_TAP_TOKEN`を更新
3. 次回のリリースから自動的に新トークンを使用

## 参考リンク

- [Homebrew Cask Documentation](https://docs.brew.sh/Cask-Cookbook)
- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Windowsとの同時リリース

ReleaseはWindows NSISの検証成功を条件にmacOS DMGと一括公開します。Homebrew CaskはmacOS DMGのみを参照し、Windowsの導入は[Windows版](windows.md)を参照してください。

## 第三者告知とFFmpegソース

次回のsource-bundle対応Releaseではinstallerと同じReleaseに`media-tools-sources-<version>.tar.gz`を添付し、SHA256SUMSへ含めます。[対応ソースの取得・再build手順](third-party-distribution.md)。既存v0.17.3のassetを上書きしません。
