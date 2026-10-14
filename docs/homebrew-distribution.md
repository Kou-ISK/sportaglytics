# Homebrew配布ガイド

SporTagLyticsのMac版を既存の`Kou-ISK/homebrew-tap`から配布します。バージョン準備・署名・公証・公開判断の正本は[Release手順](../.github/RELEASE.md)です。同じバージョンのDMGを差し替えず、新しい版を発行します。

## 利用者のインストール

```bash
brew tap Kou-ISK/tap
brew install --cask sportaglytics

# 更新
brew upgrade --cask sportaglytics

# アンインストール
brew uninstall --cask sportaglytics
```

Caskの`arch arm: "arm64", intel: "x64"`でCPUをDMG名へ対応付け、`#{arch}`をURLに使います。HomebrewのCPU識別名をURLへ直接埋め込みません。

## Macの公開とTap更新

1. 作業ブランチから`develop`、`develop`から`main`へPRで統合し、review済みmainへ新しいversion tagを作ります。
2. [Release desktop](https://github.com/Kou-ISK/sportaglytics/actions/workflows/release.yml)をmainから手動実行します。version・mainの完全SHA・publishを入力します。0.17.5は`include_windows=true`を指定し、同一commitのWindows新規buildとインストール後検査も通します。tag pushだけでは起動しません。
3. 既定の`publish=false`は署名・Apple公証・最終DMG検証を実行し、Actions artifactだけを保存します。公開承認済みの`publish=true`実行は全ゲートを改めて通し、そこで検査したDMGを新しいReleaseへ公開します。
4. 公開成功後、既存`HOMEBREW_TAP_TOKEN`でTapをcheckoutし、`scripts/macos/write-cask.mjs`が最終DMG reportのversionとSHA256からCaskを生成してcommit/pushします。秘密の値をclone URLへ埋め込みません。
5. 公開した両DMGのdownload bytes、ReleaseのSHA256SUMS、Actions検証report、Tapのarm64/x64 hashを照合します。clean macOSでインストール・起動・文書関連付けを確認します。

`publish=false`でもAppleへのアプリ送信が発生します。未署名候補の検査としてworkflowを起動しません。既存認証の有効性を確認できない場合は該当stepを停止し、新規tokenや権限拡張をこの手順へ自動で追加しません。[認証の境界](../.github/RELEASE.md#既存認証の利用)。

## OS別Releaseと更新検出

既定のMac単独ReleaseはWindows CIから独立しています。`include_windows=true`では同じcommitからWindowsを新規build・インストール検査して両OSを一度に公開します。0.17.5は両OSを選択します。導入方法は[Windows版](windows.md)を参照してください。

Homebrew livecheckは`github_releases`を使い、draft/prereleaseを除外した上で、tagのversionと一致するarm64/x64両DMGのassetがあるReleaseだけを返します。GitHubのLatestがWindows専用Releaseになっても、存在しないMac DMGを選びません。対象OSが異なるため、GitHubのLatest表示とMac Caskのversionが異なる場合があります。

## 失敗時の扱い

- ビルド・E2E・署名・公証・最終DMG検証に失敗した場合、ReleaseとTapは更新しません。失敗stepと固定dependency版を確認して通常のPRで直します。
- Tap更新だけ失敗した場合は、公開済みDMGと照合済みhashでTapを復旧します。既存Releaseの再生成、DMGの再upload、tagの付け替えはしません。
- 既存`HOMEBREW_TAP_TOKEN`の失効やアクセス不足は、値を出さず管理者へ報告します。新規発行や権限変更は別途判断します。
- Gatekeeperが拒否した配布物は完成版として扱わず、download hashと最終DMG内アプリの署名・公証検査を確認します。Release検査を回避するためのセキュリティ設定変更は案内しません。

## 第三者告知と対応source

Macの2 DMGと同じReleaseに`media-tools-sources-<version>-macos.tar.gz`を添付し、SHA256SUMSへ含めます。FFmpeg / FreeType / HarfBuzzの固定source、build scripts、Mac 2 targetのmanifestを列挙したarchiveです。[内容と再build手順](third-party-distribution.md)。公開済みの全OS source bundleもそのまま保持します。

## 参考

- [Homebrew Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)
- [GitHub Releases livecheck strategy](https://docs.brew.sh/rubydoc/Homebrew/Livecheck/Strategy/GithubReleases.html)
- [Release workflow](../.github/workflows/release.yml)
