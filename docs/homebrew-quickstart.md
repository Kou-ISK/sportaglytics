# Homebrew Quick Start

## インストールと更新

```bash
brew tap Kou-ISK/tap
brew install --cask sportaglytics

# 更新
brew upgrade --cask sportaglytics
```

公開済みのMac版は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)と[Homebrew Tap](https://github.com/Kou-ISK/homebrew-tap)で確認できます。Windows向けReleaseはMacの更新対象になりません。

## リリース担当者

新しいversionを作業ブランチで準備し、`develop`→`main`のPRとレビューを通してからtagを作成します。tag pushだけでは公開されません。

[Release macOS](https://github.com/Kou-ISK/sportaglytics/actions/workflows/release.yml)で**Run workflow**を選び、branch `main`、version、レビュー済みmainの完全SHAを指定します。既定の`publish=false`は署名・Apple公証・最終DMG検証とActions artifact保存までを行います。公開承認済みの実行だけ`publish=true`を指定します。これは未署名検査用のworkflowではありません。

既存SecretsのCI内利用、必要なゲート、公開後の照合、失敗時の境界は[Release手順](../.github/RELEASE.md)を正本とします。Homebrew固有の手順は[配布ガイド](homebrew-distribution.md)を参照してください。公開済みtag/DMGは差し替えず、Tapだけ失敗した場合は公開済みDMGのhashから復旧します。
