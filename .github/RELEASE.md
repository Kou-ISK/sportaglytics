# Release Process

このドキュメントは SporTagLytics の GitHub Release 運用手順です。Homebrew Tap の詳細は [docs/homebrew-distribution.md](../docs/homebrew-distribution.md) を参照してください。

## Current Workflow

`.github/workflows/release.yml` は次の方法で起動します。

- `v*` tag push
- GitHub Actions の `workflow_dispatch`

現行 workflow は macOS runner で macOS DMG を作成します。Windows / Linux artifacts は `electron-builder.json` に設定がありますが、現行 release workflow では生成していません。

生成される artifact:

- `SporTagLytics-<version>-arm64.dmg`
- `SporTagLytics-<version>-x64.dmg`

`<version>` は `package.json` の `version` を正とします。手動実行時も、入力 version と `package.json` の version を一致させてください。

Release workflow は source quality gates と build/preload/media tool 検証後、macOS runner 上で `pnpm run test:e2e` を実行します。Electron E2E が1件でも失敗した場合は DMG packaging、GitHub Release 作成、Homebrew Tap 更新へ進みません。

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
   pnpm exec tsc --noEmit
   pnpm exec tsc -p electron/tsconfig.json
   pnpm run lint
   pnpm run check:architecture
   pnpm run check:adr
   pnpm run test:ci
   ```

4. Run build / Electron / package checks when release files or Electron boundary changed:

   ```bash
   pnpm run build
   pnpm run build:electron-main
   pnpm run bundle:preload
   pnpm run check:preload
   pnpm run media:build:all-mac
   pnpm run test:e2e
   pnpm run electron:package:mac
   ```

   `test:e2e` は verified media tools の build 後に macOS 上で実行し、成功するまで packaging / public release / Homebrew update を行いません。

5. Confirm docs affected by the release are updated:
   - `README.md`
   - `docs/README.md`
   - `docs/homebrew-distribution.md`
   - `docs/homebrew-quickstart.md`
   - `docs/privacy-and-data-handling.md` when data handling changed

## Tag-Based Release

```bash
git checkout develop
git pull --ff-only origin develop

# after version/changelog commit is created on develop
git push origin develop

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

The workflow creates or replaces `v<version>` release assets based on `package.json`.

## Manual Release Dispatch

1. Open GitHub Actions.
2. Select `Release`.
3. Click `Run workflow`.
4. Enter a version matching `package.json`.
5. Watch security audit, quality gates, build/preload/media-tool verification, Electron E2E, macOS package, SHA256, release, and Homebrew update steps.

## Post-Release Verification

- GitHub Release exists and includes both `arm64` and `x64` DMGs.
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
- failing script (`e2e-clip-sync`, `e2e-code-window-menu`, `e2e-export-progress`, `e2e-timeline-rows`) とその前段の build/preload/media-tool log を確認します。
- 修正は通常の work branch → `develop` PR で行い、release preparation をやり直します。

### Artifact names do not match

- Confirm `electron-builder.json` `artifactName` still matches `SporTagLytics-<version>-<arch>.dmg`.
- Confirm `package.json` version matches the tag version without `v`.

### Homebrew update failed

- Confirm `HOMEBREW_TAP_TOKEN` is valid and has access to `Kou-ISK/homebrew-tap`.
- Confirm the tap repository exists and has `Casks/` writable by the token.
- Re-run the workflow after fixing the secret, or manually update the cask using the SHA256 values from the workflow log.
