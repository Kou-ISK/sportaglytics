# Homebrew配布ガイド（完全自動化版）

このドキュメントでは、Tag My VideoをHomebrew Caskで**完全自動配布**するための手順を説明します。

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
brew install --cask tag-my-video
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

1. https://github.com/Kou-ISK/tag-my-video/settings/secrets/actions にアクセス
2. "New repository secret" をクリック
3. 以下を入力:
   - Name: `HOMEBREW_TAP_TOKEN`
   - Secret: 上記でコピーしたトークンを貼り付け
4. "Add secret" をクリック

## リリース手順（完全自動化）

以降は**タグをプッシュするだけ**で全て自動化されます！

### 1. バージョン番号を更新

```bash
# package.jsonのversionを更新
vim package.json  # "version": "0.2.0" に変更
```

### 2. コミット&タグプッシュ

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0"
git push origin main

# タグをプッシュ（これで自動化開始！）
git tag v0.2.0
git push origin v0.2.0
```

### 3. 自動実行される処理（5-10分）

GitHub Actionsが以下を自動実行します:

```
1. ビルド環境の準備
   ├─ Node.js 20セットアップ
   ├─ pnpm 9インストール（キャッシュ利用）
   └─ 依存関係インストール

2. アプリケーションのビルド
   ├─ React アプリをビルド
   ├─ Electron TypeScriptコンパイル
   └─ Intel & Apple Silicon 両対応で.zipを生成

3. SHA256ハッシュの計算
   ├─ arm64版のSHA256を自動計算
   └─ x64版のSHA256を自動計算

4. GitHubリリースの作成
   ├─ リリースノート自動生成
   └─ .zipファイルをアップロード

5. Homebrew Tapの自動更新 ⭐
   ├─ homebrew-tapリポジトリをクローン
   ├─ Cask formulaを新バージョン・SHA256で生成
   ├─ 自動コミット
   └─ 自動プッシュ
```

### 4. 完了確認

- Releaseページを確認: https://github.com/Kou-ISK/tag-my-video/releases
- Homebrew Tapが自動更新されたことを確認: https://github.com/Kou-ISK/homebrew-tap

### 5. ユーザーが更新可能に

```bash
brew upgrade --cask tag-my-video
```

**これだけ！手動作業は一切不要です。**

## ユーザーのインストール方法

```bash
# 初回のみTapを追加
brew tap Kou-ISK/tap

# インストール
brew install --cask tag-my-video

# アップデート
brew upgrade --cask tag-my-video

# アンインストール
brew uninstall --cask tag-my-video
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
brew install --cask tag-my-video
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
