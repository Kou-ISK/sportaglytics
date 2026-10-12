# 第三者コンポーネントの配布

## 告知の生成と配置

アプリのMITと第三者のライセンスを区別する入口は[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)です。renderer/preload build時に`scripts/license-inventory.mjs`が、出力chunk内のnpm moduleを列挙し、package名・version・licenseとルートおよび使用moduleまでの経路上のLICENSE/COPYING/NOTICE全文をJSONへ保存します。開発専用依存やpnpm store全体は収録しません。Storybookは自身のVite設定でアプリ用inventory pluginを除外します。ライセンス本文が見つからない依存を含むbuildは失敗します。npm配布で本文が欠ける既知の版に限り、[上流補足](../resources/third-party/README.md)、配布JS内の全文、既存のMediaPipe告知から補完します。

`electron-builder`はアプリのLICENSE、上記告知とJSONをResources直下へコピーし、従来の`build/**/*.LICENSE.txt`除外を行いません。`after-pack.mjs`はpackaging済みResourcesの告知とmedia licenseを確認してから既存のevent runner署名処理を呼びます。これらのJSONはJSのlicense inventoryであり、Electron内の依存・native tool・モデルを網羅したSBOMとは呼びません。

Paintは既存のApache LICENSE/NOTICE、llama.cppとWindowsのNotoフォントも既存の告知を保持します。FreeTypeの`LICENSE.TXT`はライセンス選択の説明なので、選択するFTLの本文`docs/FTL.TXT`も同梱します。Electron/Chromiumの告知はElectron配布に含まれ、プラットフォーム固有の配置を維持します。

macOS llama.cpp b7849のJSON・cpp-httplib・BoringSSLの告知は、両archの固定上流実行ファイルに全文が埋め込まれ、`--license`で表示する構造です。2026-10-12に上流の固定source本文とのbytes一致を確認しました。専用ファイルとしてのコピーと検査がなかったため、次版から`llama/darwin/licenses/`にも同梱し、cacheと`afterPack`で全文hash・実行ファイル内の本文を検査します。[出典とhash](../resources/third-party/llama-b7849/README.md)。旧版に依存告知が完全に存在しなかったとは扱いません。全native依存やcompiler runtimeの権利確認を完了したという意味でもありません。

event packを同梱する場合は、上記のアプリ告知とは別に[packの由来記録](event-pack-provenance.md)とLICENSE/NOTICEを検査します。`afterPack`は全packの検査完了後にrunnerを署名します。空stagingの配布は維持します。

## FFmpegの対応ソース

[FFmpegの公式案内](https://ffmpeg.org/legal.html)を踏まえ、installerと同じReleaseに`media-tools-sources-<version>.tar.gz`を添付します。バイナリはappから別processで起動する構成です。FFmpeg内部のstatic linkとアプリ自身によるlibrary linkを混同しません。

source archiveに含むもの:

- FFmpeg、FreeType、HarfBuzz、Windows用OpenH264/zlibの上流source archive（version・URL・SHA-256固定）。
- `scripts/build-media-tools.mjs`と`scripts/media-tools/`のビルド手順。FFmpeg Windows manifestへのUTF-8設定追加も`windows.mjs`に含む。
- `manifest.json`のsource一覧と3 targetの`build.json`。署名・packaging前のbuild binary hashとsource version/hashを照合できる。署名後の配布ファイルのhashと同一とは限らない。
- この手順とアプリ側build scriptのMIT License。上流のライセンス本文は各source archiveに含む。

source-only準備は`pnpm run licenses:sources`です。これは固定source archiveを取得しますが、native toolの再ビルドはしません。取得量は各上流archiveに依存します。FreeTypeのSavannah mirrorがタイムアウトする場合は、[公式が案内するSourceForge mirror](https://freetype.org/download.html)へ切り替え、同じ固定SHA-256を必ず検証します。versionやsource bytesは変更しません。zlibは同じSHA-256が公開された[公式GitHub Release](https://github.com/madler/zlib/releases/tag/v1.3.2)を優先します。native buildとsource-only準備は同じ検証付きdownloaderを使用し、不完全なcacheやHTML応答を採用しません。Releaseでは`node scripts/package-media-sources.mjs --require-builds`を実行し、Windows CIから受け取るmanifestとmacOS 2 targetのmanifestが揃わない場合や、source hashが違う場合は公開を止めます。

再ビルドはarchiveを展開して次を行います。Node.js 22.12以上、tar/curlと各OSのcompilerが必要です。macOSはXcode command line tools、cmake、pkg-config、WindowsはMSYS2 UCRT64のgcc/cmake/ninja/pkgconf/nasm/makeを用います。CIの具体的な環境は同じRelease tagの`.github/workflows/windows.yml` / `release.yml`で確認できます。

1. 同梱`upstream/`のarchiveを`.cache/media-tools/source/`へ同じファイル名でコピーする。
2. macOSは`node scripts/build-media-tools.mjs --all-mac`、WindowsはUCRT64 shell内で`node scripts/build-media-tools.mjs`を実行する。
3. `.cache/media-tools/<target>/build.json`とbinaryを確認する。compiler/SDK差によるバイト一致までは保証しない。

FFmpegへの変更はWindows用manifest設定のみで、無改変の上流archiveと適用scriptを一緒に保存します。ライブラリsourceとbuild flagsを変更した場合は同じReleaseでsource archiveを更新してください。OS提供ライブラリやcompiler runtimeはこのsource一覧の対象外です。

## 検証と既存Releaseの状態

2026-10-10時点のv0.17.3はDMG 2本、NSIS 1本、SHA256SUMSのみでした。2026-10-12に同tagのrecipeと実配布物のmanifestに対応するsource/FreeType FTL補足と専用checksumを追記公開しました。v0.8.0にもGit内llama.cpp binaryに対応するMIT本文・照合記録と専用checksumを追記しました。公開リンクと照合範囲は [由来の確認台帳](provenance-review.md#過去配布物の補足状況) を参照してください。元installer・元checksum・tagは保持しています。

2026-10-11の実配布物照合では、同版の3 targetでsource版/hash、Windowsでffmpeg/ffprobeのbinary hashを確認しました。macOSの署名後hashは別途検証が必要です。FreeType FTL本文と過去JS/native告知の不足・未確認範囲は [由来の確認台帳](provenance-review.md#過去配布物の補足状況) に記録します。新4ファイルは公開downloadのbytes/hashを照合済みですが、旧JS/native推移依存の告知や全旧installerの網羅性、法的充足性まで完了したとは扱いません。

変更後の最小検証は、通常renderer/preload build、生成inventory内容、electron-builderのdirectory packageでResourcesと`app.asar`のnotice保持を確認します。macOS署名・公証やWindows installerの再検証は対応OSのCIが正本です。Linuxでのdirectory package成功をmacOS/Windows配布の検証へ読み替えません。

モデル・GGUF・動画・private R&D・ローカルパスをsource archiveへ含めません。[モデル台帳](model-distribution.md)は別の公開境界を扱います。
