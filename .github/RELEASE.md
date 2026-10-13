# Release Process

このドキュメントは SporTagLytics の GitHub Release 運用手順です。Homebrew Tap の詳細は [docs/homebrew-distribution.md](../docs/homebrew-distribution.md) を参照してください。

## 公開済みv0.17.4と次版候補

v0.17.4は公開済みです。developの`package.json`がまだ0.17.4でも、公開後の告知修正やテスト変更を同じtag/Releaseへ再配布しません。次版は品質と[由来の確認状態](../docs/provenance-review.md#次版候補の確認状態)をレビューしてから版を決め、準備PRを`develop`へ統合し、`develop`から`main`へのPRを通した後に新しいtagを作成します。公開済みの版と配布物は[Releases](https://github.com/Kou-ISK/sportaglytics/releases)で確認してください。

既存候補で確認したmacOSの操作・分析PNGは、アプリコードの同一性を確認した場合に引き継げます。版番号を変更した配布物の検証、同じ候補のWindows CI、署名・公証は別途必要です。full auditを含む未通過のゲートがある間は正式Releaseを起動しません。

ローカルE2EのPaint内native AI検査は`E2E_LLAMA_MODEL`設定時だけ実行します。正式Release CIはこの変数と検証済みテストモデルの準備を常に設定するため、native AIを含む全E2Eの成功が必要です。変数なしのローカル22シナリオ成功を、正式CIと同じ検証範囲とは扱いません。テスト用GGUFの重みは配布物に含めません。

## Current Workflow

`.github/workflows/release.yml` は次の方法で起動します。

- `v*` tag push
- 承認済みの復旧時に限るGitHub Actions の `workflow_dispatch`

タグpushが通常の起動方法です。タグpush後に同じReleaseを手動dispatchしません。workflowにはdry-runやdraft公開の選択肢がなく、成功するとGitHub Releaseを公開しHomebrew Tapを更新します。

配布jobはタグまたは手動実行だけを受け付けます。main側にbranch push triggerが残っていても、タグ作成前のpushではjobをskipします。

Windows runnerでNSISインストーラーとインストール後の操作を検証し、成功後にmacOS runnerで署名・公証済みDMGを作成します。両OSの生成・検証が成功した場合にまとめてGitHub Releaseへ公開します。Linux artifactは公開しません。

生成される artifact:

- `SporTagLytics-<version>-arm64.dmg`
- `SporTagLytics-<version>-x64.dmg`
- `SporTagLytics-Setup-<version>-x64.exe`
- `media-tools-sources-<version>.tar.gz`（対応sourceとbuild manifest）
- `SHA256SUMS.txt`

`<version>` は `package.json` の `version` を正とします。手動実行時も、入力 version と `package.json` の version を一致させてください。

Release workflow は source quality gates と build/preload/media tool 検証後、macOS runner 上で `pnpm run test:e2e` を実行します。Electron E2E が1件でも失敗した場合は DMG packaging、GitHub Release 作成、Homebrew Tap 更新へ進みません。

Windows CIは[Windows版](../docs/windows.md)の手順でFFmpeg、AIランタイム、フォントを用意します。Windowsの署名証明書は現在設定されておらず、NSISは未署名です。Release noteではWindowsの署名状態を明示してください。macOS用の `CSC_LINK` をWindowsへ流用しません。後日署名を導入する際は専用のcredential境界を追加し、新しいバージョンのartifactとして公開します。

Paintの俯瞰配置用モデル・WASMは `pnpm run build` の `vision:prepare` で準備し、`build/pitch-vision/` と権利表示をアプリへ同梱します。モデルのSHA-256不一致やダウンロード失敗はbuildを失敗させます。配布後にネットワーク取得へフォールバックさせません。`e2e-tactical-board.mjs` をmacOS / Windows / installed Windowsで実行し、HTTP遮断下の推論と保存・画像出力を確認します。詳細は[開発手順](../docs/development.md#戦術盤の端末内認識)を参照してください。

## Required Secrets

| Secret                        | Required for                         |
| ----------------------------- | ------------------------------------ |
| `GITHUB_TOKEN`                | GitHub Release creation              |
| `HOMEBREW_TAP_TOKEN`          | `Kou-ISK/homebrew-tap` auto update   |
| `CSC_LINK`                    | macOS code signing certificate       |
| `CSC_KEY_PASSWORD`            | macOS code signing certificate       |
| `APPLE_ID`                    | notarization when signing is enabled |
| `APPLE_APP_SPECIFIC_PASSWORD` | notarization when signing is enabled |
| `APPLE_TEAM_ID`               | notarization when signing is enabled |

If `HOMEBREW_TAP_TOKEN` is missing, the Homebrew update step fails. Before publication, verify the intended signing identity, notarization submission and accepted result. A packaging exit code alone is insufficient: electron-builder can skip signing/notarization when credentials are unavailable.

## 署名・公証の対象と実行境界

以下は既存設定と固定依存（electron-builder 26.16.1、@electron/notarize 2.5.0）の読取による手順整理です。credentialの存在・使用権限はこの文書では確認済みとしません。[AppleのDeveloper ID案内](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)と[公証手順](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)を実行担当者が確認します。新規証明書発行と既存証明書の利用は別の権限です。Appleの案内は新規発行にAccount Holderのroleを求め、cloud-managed証明書には別のaccess roleも示しています。新規発行を既存候補の検査へ自動で追加しません。

| 工程 | 必要な既存資格・権限 | 対象・確認 |
| --- | --- | --- |
| アプリ署名 | 有効なDeveloper ID Applicationと対応する秘密鍵の正当な利用権限。実行Macで利用できるidentityを確認 | hardened runtime、既存entitlements、各native executable/libraryとアプリの署名を検証。署名は新規取得・移設・keychain ACL変更の許可を意味しない |
| Apple公証 | 正規のteam/accountに対応する既存notary credentialと送信権限。workflowは上のAPPLE_* secretを使う | builderは署名した`.app`をZIPへ包み、notarytoolでAppleへ送信して結果を待つ。成功後にアプリへticketをstapleし、DMGを生成する |
| 公開 | release candidate、版/tag、告知/source、品質と権利判断の承認、既存GitHub/Homebrew権限 | release.ymlはGitHub Release作成とHomebrew更新まで実行する。公証受理や署名成功を公開承認・権利確認へ読み替えない |

Appleへの送信対象はアプリ本体・framework・native binary・アイコン・フォント・Paint重み/WASM等を含む`.app`です。event stagingは実Resourcesでも空を確認し、GGUF・動画・user profile・私有packを含めません。私有packを追加した場合は、その内容の配布とApple送信を別途確認します。送信前に対象commit、Resources/ASARの一覧とhash、含むモデル、送信先・実行者の権限を確認し、秘密の値やkeychainの詳細を公開ログへ出しません。

`--publish never`はbuilderの公開処理を抑止する指定で、Appleへの公証送信を抑止しません。公開前の未署名候補では、source外の候補設定に`publish: null`、`mac.identity: null`、`mac.notarize: false`、`forceCodeSigning: false`を明示し、署名自動検出とcredential import用環境変数を無効にします。release.ymlのdispatchは候補検査の代わりに使いません。

`CSC_LINK`が設定されたbuilderは、一時keychain作成と証明書importを行います。既存ローカルidentityだけで検証する工程ではこれを設定せず、証明書の作成・移設、keychain解除/ACL変更、notary profile作成を自動で行いません。identityの欠落・曖昧さ、権限不足、secretの不足は停止条件です。必要な変更は対象と理由を明示した別の判断にします。

現行設定はアプリ署名/公証とDMG container署名を区別します。`dmg.sign`は設定されておらず既定falseです。アプリの署名・ticketを、DMG container自体の署名の確認と表現しません。古いDMGを作った後に別のアプリへstapleしても、そのDMG内のアプリは更新されません。最終配布物内のアプリでもcodesign、stapler、Gatekeeperと告知/hashを確認します。

NOTICEや同梱資産を変更した後は、最終sourceから候補を再packagingし、Resourcesの本文/全ファイルhashを取り直します。変更前の候補の署名・checksum・告知検査を、そのまま新しい配布物の検査結果として引き継ぎません。

## Pre-Release Checklist

event packを同梱する場合は[配布前レビューと由来記録](../docs/event-pack-provenance.md)を完了します。`afterPack`が実際のResources内の全packを署名前に検査し、未記録・未承認・不整合なら停止します。event packを同梱しないReleaseは引き続き可能ですが、Paintの既製重みは含まれるため、すべてのモデルを除外した配布とは扱いません。署名前の記録、署名後manifest、最終installer checksumを区別して保管してください。

1. Update `package.json` version.
2. Move relevant `CHANGELOG.md` entries from `[Unreleased]` to the release version.
3. Run quality gates:

   ```bash
   pnpm install --frozen-lockfile
   pnpm audit
   pnpm audit --prod
   pnpm exec tsc --noEmit
   pnpm exec tsc -p electron/tsconfig.json
   pnpm run lint
   pnpm run check:architecture
   pnpm run check:design-system
   pnpm run check:adr
   pnpm run test:ci
   pnpm run build:storybook
   ```

4. Run build / Electron / package checks when release files or Electron boundary changed:

   ```bash
   pnpm run build
   pnpm run build:electron-main
   pnpm run bundle:preload
   pnpm run check:preload
   pnpm run media:build:all-mac
   pnpm run llama:prepare:mac
   pnpm run test:e2e
   pnpm run electron:package:mac
   ```

   `test:e2e` は verified media tools の build 後に macOS 上で実行し、成功するまで packaging / public release / Homebrew update を行いません。

5. Confirm Windows CI passes on the same release candidate, including native dependency checks, Electron E2E, NSIS packaging and installed-app E2E. Preserve the run URL and artifact evidence with the candidate SHA.
6. Confirm docs affected by the release are updated:
   - `README.md`
   - `docs/README.md`
   - `docs/homebrew-distribution.md`
   - `docs/homebrew-quickstart.md`
   - `docs/privacy-and-data-handling.md` when data handling changed

## Tag-Based Release

```bash
git checkout develop
git pull --ff-only origin develop
git checkout -b release/prepare-<version-with-hyphens>

# update version/changelog/docs and complete candidate checks
git add package.json CHANGELOG.md README.md docs .github/RELEASE.md
git commit -m "chore(release): prepare <version>"
git push -u origin HEAD
gh pr create --draft --base develop --title "chore(release): prepare <version>" --body-file <candidate-review-file>

# after candidate CI / review passes, merge the preparation PR into develop
# create and merge a GitHub PR: develop => main
gh pr create --base main --head develop --title "Release v<version>" --body "Release v<version>"

# after CI / review / branch protection passes
gh pr merge --merge

git checkout main
git pull --ff-only origin main

# tag from main after the develop => main PR is merged
git tag v<version>
git push origin v<version>
```

The workflow validates that the version/tag agree and the tagged commit belongs to `main`. Releases are immutable: publication uses `gh release create --verify-tag` and fails if that release already exists. Never delete or replace published tags/DMGs; corrections use a new version. See [ADR 0032](../docs/adr/0032-immutable-release-artifacts.md).

## Manual Release Dispatch

手動dispatchは承認済みの復旧に限ります。同じタグのrunが進行中の場合やReleaseが公開済みの場合は起動しません。既存artifactやタグを差し替えず、ソース修正が必要なら新しいバージョンで準備をやり直します。

1. Open GitHub Actions.
2. Select `Release`.
3. Select `main` at the version/tag commit, then click `Run workflow`. The matching version tag must already exist.
4. Enter a version matching `package.json`.
5. Watch security audit, quality gates, build/preload/media-tool verification, Electron E2E, macOS package, SHA256, release, and Homebrew update steps.

## Post-Release Verification

- GitHub Release includes both Mac DMGs, the Windows x64 installer, `media-tools-sources-<version>.tar.gz`, and `SHA256SUMS.txt`.
- Windows installed-app E2E and native dependency checks passed for the released commit.
- SHA256 values in `Kou-ISK/homebrew-tap` match generated artifacts.
- Homebrew install works:

  ```bash
  brew update
  brew tap Kou-ISK/tap
  brew install --cask sportaglytics
  ```

- App launches on a clean macOS environment.
- `.stpkg`, `.stpl`, `.stcw`, `.stad` file associations still work.

## Troubleshooting

### Release workflow did not start

- Confirm tag name starts with `v`.
- Confirm the tag was pushed to GitHub.
- Confirm Actions are enabled for the repository.

### Electron E2E failed

- DMG / GitHub Release / Homebrew update は実行されません。
- failing script (`e2e-clip-sync`, `e2e-code-window-menu`, `e2e-export-progress`, `e2e-timeline-rows`, `e2e-paint`, `e2e-package-reopen`, `e2e-event-detection`) とその前段の build/preload/media-tool log を確認します。
- 修正は通常の work branch → `develop` PR で行い、release preparation をやり直します。

### macOS signing keychain unlock failed

`security import` が成功した後に `set-key-partition-list` で `SecKeychainUnlock` が発生する場合、証明書のパスワードと一時キーチェーンのパスワードの取り違えを確認します。electron-builder 26.16.1はこの既知不具合を修正しています（[upstream #10172](https://github.com/electron-userland/electron-builder/pull/10172)）。package.jsonとlockfileのbuilder一式を同じ修正版に揃え、secretの変更や署名の省略で回避しません。

タグ作成後にbuild依存の修正が必要になった場合は、新しいpatch versionを通常のPR順序で配布します。失敗したタグも付け替えず、公開DMGの有無をCHANGELOGに記録します。

### Artifact names do not match

- Confirm `electron-builder.json` `artifactName` still matches `SporTagLytics-<version>-<arch>.dmg`.
- Confirm `package.json` version matches the tag version without `v`.

### Homebrew update failed

- Confirm `HOMEBREW_TAP_TOKEN` is valid and has access to `Kou-ISK/homebrew-tap`.
- Confirm the tap repository exists and has `Casks/` writable by the token.
- Retry only the failed Homebrew step after fixing the secret, or update the cask using the published DMGs and their SHA256 values. Do not repackage or replace an already published release.

## Third-party notices and corresponding source

renderer/preloadのlicense inventoryとResourcesの告知検査を通過させます。Windows CIはinstallerとともにmedia build manifestを渡し、macOS jobは3 targetのmanifestと固定source archiveを照合して`media-tools-sources-<version>.tar.gz`を作成します。これを同じReleaseとSHA256SUMSへ含めます。source bundleが欠ける場合は公開しません。[内容・手順・過去版の不足](../docs/third-party-distribution.md)。
