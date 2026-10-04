# Release Process

このドキュメントは SporTagLytics の GitHub Release 運用手順です。Homebrew Tap の詳細は [docs/homebrew-distribution.md](../docs/homebrew-distribution.md) を参照してください。

## 0.17.3 Release

`package.json` の0.17.3を配布対象とします。正式検証で停止した0.17.2はタグを保持し、配布物を公開せず、修正を0.17.3へ含めます。作業ブランチから`develop`へのPR、`develop`から`main`へのPRを通し、統合後のmainに新しいタグを作成します。公開済みの版と配布物は[Releases](https://github.com/Kou-ISK/sportaglytics/releases)で確認してください。

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

If `HOMEBREW_TAP_TOKEN` is missing, the Homebrew update step fails. If signing / notarization secrets are missing, check the electron-builder behavior and workflow logs before publishing a public release.

## Pre-Release Checklist

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

- GitHub Release includes both Mac DMGs, the Windows x64 installer, and `SHA256SUMS.txt`.
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
