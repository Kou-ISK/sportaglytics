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
   pnpm run test:run
   ```

4. Run build/package checks when release files or Electron boundary changed:

   ```bash
   pnpm run build
   pnpm exec tsc -p electron/tsconfig.json
   pnpm run bundle:preload
   pnpm run check:preload
   pnpm run electron:package:mac
   ```

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

git checkout main
git pull --ff-only origin main
git merge --no-ff develop
git push origin main

# tag from main after develop is merged
git tag v<version>
git push origin v<version>
```

The workflow creates or replaces `v<version>` release assets based on `package.json`.

## Manual Release Dispatch

1. Open GitHub Actions.
2. Select `Release`.
3. Click `Run workflow`.
4. Enter a version matching `package.json`.
5. Watch the macOS package, SHA256, release, and Homebrew update steps.

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

### Artifact names do not match

- Confirm `electron-builder.json` `artifactName` still matches `SporTagLytics-<version>-<arch>.dmg`.
- Confirm `package.json` version matches the tag version without `v`.

### Homebrew update failed

- Confirm `HOMEBREW_TAP_TOKEN` is valid and has access to `Kou-ISK/homebrew-tap`.
- Confirm the tap repository exists and has `Casks/` writable by the token.
- Re-run the workflow after fixing the secret, or manually update the cask using the SHA256 values from the workflow log.
