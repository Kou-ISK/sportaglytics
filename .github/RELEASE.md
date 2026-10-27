# Release Process

デスクトップReleaseの正本です。配布方針は[ADR 0063](../docs/adr/0063-independent-macos-release.md)、Homebrewは[配布手順](../docs/homebrew-distribution.md)を参照してください。

## 0.17.15と公開済み版

0.17.15は再生中核をAVPlayerへ是正し、通常画面の不要なコピー操作・方式表示を撤去するMac向け修正版です。公開済みv0.17.14とv0.17.12のtag・配布物を保持します。公開状態は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を確認してください。

修正とrelease準備は先にdevelopへ通常PRで統合します。未公開モデル配布方針を混在させないため、今回もmainを基点とする`release/apple-player-0.17.15`からmainへPRを作り、今回の修正commitだけを適用します。モデル固有lock更新はdevelopに保持し、mainへ持ち込みません。[ARCH-EX-003](../docs/architecture-exceptions.md)に範囲と期限を記録します。mainへの直接push、公開tagの付け替え、同じ公開版への後付けartifactは禁止です。

## MacとWindowsの実行境界

`.github/workflows/release.yml`（**Release desktop**）は既定でMacだけを生成します。`include_windows=true`では同じdispatchのcommitから[`windows.yml`](workflows/windows.yml)を再利用し、Windowsの通常runner・インストール後runnerの全登録シナリオ・CPU MP4 5条件と同梱物の検査を通します。成功した同一runのartifactだけを取得し、source commit/tree、version、実installer hash、同梱media manifestを再照合して両OSを一度に公開します。0.17.15はMacのみの配布として`include_windows=false`を指定します。Windowsの既存配布物は維持し、PR上の既存Windows互換検査は省略しません。以前のCI候補や別versionのinstallerは流用せず、公開済みReleaseへ後付けしません。

Native標準化候補は既存公開versionを再使用せず、main統合後に未使用version/tagを確定します。arm64は`native:build`とmanifestに列挙したAVPlayer資源の検証、2helperのDeveloper ID署名、外側app署名、公証、実起動を要求します。署名後も元unsigned manifestと対応sourceを保持します。新defaultの機能・品質受入が未完了なら公開しません。

Macの必須assets:

- `SporTagLytics-<version>-arm64.dmg`
- `SporTagLytics-<version>-x64.dmg`
- `media-tools-sources-<version>-macos.tar.gz`
- `native-playback-sources-<version>-darwin-arm64-<manifest-hash-prefix>.tar.gz`
- `SHA256SUMS.txt`
- `release-verification.json`（この手順の改修以降の新規Release）

`include_windows=true`では`SporTagLytics-Setup-<version>-x64.exe`と`media-tools-sources-<version>-windows.tar.gz`も含め、全配布物を同じSHA256SUMSに記録します。

Mac source bundleは2 targetのmanifestとFFmpeg / FreeType / HarfBuzzの固定sourceを要求します。Windows source bundleは同じrunのインストール済みmedia manifestと、zlibを含む4 sourceを要求します。Macだけを選択した場合はWindows jobとWindows用sourceの取得を省略します。署名後のnative hashと署名前build manifestのhashは別の値です。source bundleは規定のファイルだけを列挙し、uid/gid/mtimeを正規化し、既存出力を上書きしません。生成にはPython 3が必要です。

## 起動方法

tag pushやmain pushでは起動しません。**GitHub Actionsの明示的なworkflow_dispatchだけ**を使います。実行前に、そのversionのReleaseがまだなく、同じworkflowが進行中でないことを確認します。

1. 準備PRとmain向けPRをレビューし、必要なCIを通して統合します。通常は`develop`→`main`、0.17.15は上記の限定したrelease branchを使います。
2. `main`の40文字SHAと`package.json`のversionを確認し、そのcommitへ`v<version>` tagを作成します。tag作成だけでは署名・Apple送信・公開を開始しません。
3. [Release desktop](https://github.com/Kou-ISK/sportaglytics/actions/workflows/release.yml) → **Run workflow** → branch **main**を選びます。
4. `version`に`0.17.15`、`expected_sha`に最終レビュー済みmainの40文字SHAを入力し、`include_windows=false`を指定します。現在の作業branchのSHAを入力しません。
5. `publish=false`（既定）は署名・公証・最終DMG検証まで行い、Actions artifactとして90日間保存します。GitHub ReleaseとHomebrewは更新しません。**これは未署名dry-runではなく、Appleへのアプリ送信を含みます。**
6. 最終公開が承認された実行は`publish=true`を指定します。同じ品質・署名・公証・DMG検証を再実行し、その実行で検査したbytesだけを公開します。先行runのartifactを無検査で流用しません。

CLIでも同じ入力を使います。`<reviewed-main-sha>`を実際の40文字SHAへ置き換えてから実行してください。

```bash
gh workflow run release.yml --ref main \
  -f version=0.17.15 -f expected_sha=<reviewed-main-sha> -F include_windows=false -F publish=false
```

workflowは入力version、package version、tag commit、checkout、workflow commit、現在のorigin/mainを照合します。省略・食い違い・既存Release・API読み取り失敗は停止条件です。公開直前にも再確認します。並行runは直列化し、実行中の署名・公証を新しいdispatchでcancelしません。

## 既存認証の利用

| Secret                                                     | 用途                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `GITHUB_TOKEN`                                             | Release存在確認と公開。Actionsが提供                             |
| `CSC_LINK`, `CSC_KEY_PASSWORD`                             | 既存Developer ID証明書をCIの一時keychainへ読み込み、アプリを署名 |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | builderからAppleのnotary serviceへ送信                           |
| `HOMEBREW_TAP_TOKEN`                                       | 公開成功後の既存Tap更新                                          |

Windowsは既存CIと同じ認証なしのbuildを使用し、実Authenticode状態を検査reportとRelease noteへ記載します。`NotSigned`を署名済みと表現しません。新しいWindows署名証明書や契約はこの手順では取得しません。

公開本文は`scripts/desktop-release-notes.mjs`が再照合済みの`windows-release.json`から生成し、`NotSigned`は「未署名」、`Valid`は「Authenticode署名を検証済み」と明記します。未知の状態では公開を停止します。E2E件数は本文へ固定せず、成功した同一runの全シナリオとログを根拠にします。日本語に隣接したshell変数のロケール依存解釈を避け、UTF-8ファイルを`gh release create --notes-file`へ渡します。

Macは既存`release.yml`と同じ認証方式です。正規の本番実行権限がある担当者は既存Secretsをworkflow内で消費できます。秘密の値をチャット・ローカルMacへ抽出したり、新しく入力・送信したりする手順は不要です。秘密の有効性は実行結果で確認し、値をログへ出しません。Tapのtokenはcheckout actionへ渡し、clone URLへ埋め込みません。

既存Secretsが不足・失効している場合は失敗したstepとsecret名だけを報告します。新規credential、証明書発行、権限拡張、Apple契約への同意、ローカルkeychain ACL変更をこのworkflow準備の一部として追加しません。既存credentialを利用するCIの一時keychain操作と、利用者Macのcredential/security変更を混同しません。

署名は`forceCodeSigning=true`、公証は`mac.notarize=true`を必須にします。`--publish never`はbuilder自身の公開を抑止しますが、Apple送信を抑止しません。署名する対象はhardened runtimeと既存entitlementsを使うアプリです。builderは署名済み`.app`をZIPとしてAppleへ送信し、成功したticketをアプリへstapleしてからDMGを作ります。既存設定の`dmg.sign`は未設定（既定false）なので、DMG container自体が署名済みとは表現しません。

## 公開前のゲート

1. lockfile固定install、full / production audit、型、lint、境界、design-system、ADR、unit、Storybookをすべて通します。
2. renderer / Electron / preloadをbuildし、Mac 2 targetのmedia toolsとllama runtimeを準備します。
3. `E2E_LLAMA_MODEL`と検証済みテストモデルを使ってMacの全Electron E2Eを通します。変数なしのローカル検査はnative AIまで通った扱いにしません。テスト用GGUFは配布物へ含めません。
4. Release専用の`afterPack`が署名前に、ASAR全fileと生成buildの同一性、モデル2配置の固定SHA、WASM、アプリ/JS/nativeの告知、media/llamaのmanifestとnative hashを検査します。通常の`afterPack`検査も引き続き実行します。
5. 現行Mac Releaseはevent packなしです。ASAR/ResourcesのGGUF・私有pack・未知の重みを拒否します。Paintの既製EfficientDet-Lite2は含まれるため、「モデルを含まない」とは表現しません。素材の権利確認は[由来の確認台帳](../docs/provenance-review.md)で別途レビューします。
6. `scripts/macos/verify-dmg.mjs`が最終DMGをread-onlyでmountします。全Mach-Oのarchitecture / Developer ID / hardened runtime / timestamp、strict署名、stapler、Gatekeeperの`Notarized Developer ID`判定、バージョン、実Resources/ASARの告知・モデル・hashを確認します。署名前reportと同梱payloadの一致も確認します。
7. 対応source archive、公開用検証要約、SHA256SUMSを生成してActions artifactに保存します。`publish=true`のときだけ、新規Release作成とHomebrew更新へ進みます。

`scripts/release-verification-summary.mjs`は最終DMG reportの両architecture・version・source SHA・署名検査件数・公証・staple・Gatekeeper・payload一致を要求し、実際のDMG bytesのSHA256と照合します。Windowsを含むときは検証済みinstallerのsource commit/tree、実bytes、署名状態も照合します。`release-verification.json`には許可した検証値、配布物hash、source commit/tree、Actions run URLだけを保存し、raw log、署名者の個人名、runnerの絶対path、環境変数を転記しません。要約自体もSHA256SUMSに含め、新規Releaseのassetとして残します。

このJSONは配布reportの要約であり、独立したattestationやunit/E2Eの再実行ではありません。品質・E2Eの結果はリンク先の同一workflowで確認します。詳細reportを含むActions artifactの保持は90日、公開要約はReleaseのassetとして保持します。既存v0.17.10以前へ後付けしません。GitHubのRelease immutabilityやbranch protectionを設定する処理は含めず、これらの管理者設定は別途確認・判断します。

どれか失敗した候補、未公証候補、検証省略のDMGを一般利用者向け完成Releaseとして扱いません。署名・公証の成功は法的な権利安全性や実機での全操作を保証しません。初回のこのworkflow変更は、本番署名・公証と最終DMGのCI成功が得られるまで「手順準備済み」と「配布検証済み」を区別します。

## 未署名のローカル候補

未署名検査ではworkflowを起動せず、別checkoutとfresh出力を使用します。source外の候補設定に`publish: null`、`mac.identity: null`、`mac.notarize: false`、`forceCodeSigning: false`を明示します。署名自動検出とcredential import用環境変数を無効にし、`--publish never`を指定します。`verify-dmg.mjs`は未署名/未公証アプリを意図的に拒否します。

## 公開後と復旧

- GitHub Releaseの全配布物とSHA256SUMSを取得し、公開bytesとActionsの検証reportのhashを照合します。両OS公開ではWindows installerとWindows source archiveも対象です。
- Homebrew Caskのarm64/x64のhashを照合し、clean macOSでインストール・起動・`.stpkg`/`.stpl`/`.stcw`/`.stad`関連付けを確認します。
- Homebrew livecheckは、draft/prereleaseを除き、両Mac DMGのassetがあるReleaseだけを選びます。後のWindows専用ReleaseをMacの最新版として選びません。
- Homebrew更新だけ失敗した場合は、公開済みDMGと確認済みhashからTapを復旧します。workflow全体を再実行して既存Releaseを作り直しません。
- version変更やsource修正が必要なら、新しい版を準備します。初回E2E/署名/公証の失敗を回避するための省略フラグは設けません。

builderの一時keychain unlock失敗では、既存の証明書パスワードと一時keychainのパスワードを取り違えないよう実行ログと固定builder版を確認します。electron-builder 26.16.1は[upstream #10172](https://github.com/electron-userland/electron-builder/pull/10172)の修正版です。secret値を露出させたり、署名を省略したりして回避しません。

Macのelectron-builder publisherは`mac.publish: null`で明示的に無効化する。`--publish never`だけでは既存GH_TOKENから更新用`app-update.yml`が自動生成されるため、DMG出力そのもので署名前の同梱物検査を実行する。公開は検証後の既存`gh release create`工程だけで行い、同梱物の許可リストは緩めない。
