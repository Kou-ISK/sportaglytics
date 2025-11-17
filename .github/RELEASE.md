# リリース手順

このドキュメントでは、SporTagLyticsの新バージョンをリリースする手順を説明します。

## 自動ビルドとリリース

GitHub Actionsを使用して、macOS、Windows、Linuxの実行ファイルを自動的にビルドし、GitHubリリースとして公開します。

### 1. バージョンの更新

`package.json`のバージョンを更新します：

```bash
# 例: 0.1.0 → 0.2.0
vim package.json
# "version": "0.2.0" に変更
```

### 2. 変更をコミット

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0"
git push origin main
```

### 3. Gitタグの作成とプッシュ

```bash
# タグを作成（vプレフィックス必須）
git tag v0.2.0

# タグをプッシュ
git push origin v0.2.0
```

### 4. 自動ビルドの実行

タグをプッシュすると、GitHub Actionsが自動的に以下を実行します：

1. **macOS**: `SporTagLytics-0.2.0.dmg` をビルド
2. **Windows**: `SporTagLytics-Setup-0.2.0.exe` をビルド
3. **Linux**: `SporTagLytics-0.2.0.AppImage` をビルド
4. **GitHub Release**: 上記ファイルを含むリリースを自動作成

ビルドの進行状況は[Actions](https://github.com/Kou-ISK/sportaglytics/actions)タブで確認できます。

### 5. リリースノートの編集（任意）

GitHub上で自動生成されたリリースノートを編集できます：

1. [Releases](https://github.com/Kou-ISK/sportaglytics/releases)ページに移動
2. 最新リリースの「Edit release」をクリック
3. リリースノートを編集して「Update release」

## 手動ビルド（開発・テスト用）

### ローカルでビルドする場合

```bash
# すべてのプラットフォームでビルド
pnpm run electron:build

# macOSのみ
pnpm exec electron-builder --mac

# Windowsのみ（Windowsマシンが必要）
pnpm exec electron-builder --win

# Linuxのみ
pnpm exec electron-builder --linux
```

ビルド成果物は`dist/`ディレクトリに出力されます。

### 手動ビルドのトリガー（GitHub Actions）

GitHubのActionsタブから手動でビルドをトリガーできます：

1. [Actions](https://github.com/Kou-ISK/sportaglytics/actions)タブに移動
2. 「Build and Release」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. バージョン（任意）を入力して「Run workflow」

## Homebrew Caskへの登録（macOS）

### オプション1: 公式homebrew-caskへ登録

1. リリース後、DMGファイルのSHA256を取得：

   ```bash
   curl -L https://github.com/Kou-ISK/sportaglytics/releases/download/v0.2.0/SporTagLytics-0.2.0.dmg | shasum -a 256
   ```

2. [homebrew-cask](https://github.com/Homebrew/homebrew-cask)にPRを送信
3. `.github/HOMEBREW.md`のテンプレートを参照してcask定義を作成

### オプション2: 独自Tapの作成

1. `homebrew-tap`という名前のリポジトリを作成
2. `Casks/sportaglytics.rb`を追加：

   ```ruby
   cask "sportaglytics" do
     version "0.2.0"
     sha256 "YOUR_SHA256_HERE"

     url "https://github.com/Kou-ISK/sportaglytics/releases/download/v#{version}/SporTagLytics-#{version}.dmg"
     name "SporTagLytics"
     desc "Video tagging application for sports analysis"
     homepage "https://github.com/Kou-ISK/sportaglytics"

     app "SporTagLytics.app"
   end
   ```

3. ユーザーは以下でインストール可能：
   ```bash
   brew tap Kou-ISK/tap
   brew install --cask sportaglytics
   ```

## トラブルシューティング

### ビルドが失敗する場合

1. **型エラー**: ローカルで`pnpm exec tsc --noEmit`を実行して型チェック
2. **依存関係エラー**: `pnpm install`を実行して依存関係を更新
3. **コード署名エラー（macOS）**:
   - 開発環境では`electron-builder.json`で`mac.identity`をnullに設定
   - CI環境では適切な証明書とプロビジョニングプロファイルが必要

### リリースが作成されない場合

- タグ名が`v`で始まっていることを確認（例: `v0.2.0`）
- GitHub Actionsのログで詳細なエラーを確認
- `GITHUB_TOKEN`の権限を確認（通常は自動設定）

## チェックリスト

リリース前に以下を確認：

- [ ] `package.json`のバージョンが更新されている
- [ ] `CHANGELOG.md`が更新されている（ある場合）
- [ ] ローカルでビルドが成功する（`pnpm run electron:build`）
- [ ] 型チェックがパスする（`pnpm exec tsc --noEmit`）
- [ ] 既存の機能が動作する（手動テスト）
- [ ] タグがプッシュされている
- [ ] GitHub Actionsのビルドが成功している
- [ ] リリースページで成果物がダウンロード可能
