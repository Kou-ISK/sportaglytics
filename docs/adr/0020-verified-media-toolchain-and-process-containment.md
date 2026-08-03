# 0020 Verified Media Toolchain and Process Containment

## Status

Accepted

## Date

2026-08-03

## Context

映像のprobe・同期・書き出しでは、ユーザーが選択した映像をnative FFmpeg/FFprobe processへ渡します。従来のnpm static binaryは、FFmpegとFFprobeの版が一致せず、Apple Silicon向けFFprobeがIntel binaryになる場合がありました。さらに、package versionだけでは実際に取得されるbinaryのFFmpeg patch versionを保証できず、既知のmedia parser脆弱性を追跡できませんでした。

probe processは時間と出力量の上限を持たず、壊れた映像や悪意ある映像によってmain processの資源を長時間消費する余地もありました。

## Decision

- 配布するFFmpeg/FFprobeはnpm binary packageから取得しない。
- `scripts/build-media-tools.mjs` がFFmpeg 8.1.2、FreeType 2.14.3、HarfBuzz 14.3.0の公式source archiveを固定URLから取得し、個別の固定SHA-256を検証してからmacOSの`x64` / `arm64`を別々にbuildする。
- release workflowはpackage作成前に両architectureをbuildし、electron-builderは対象architectureと一致するbinaryだけを`Resources/media-tools`へ収録する。
- 開発時は、環境変数、検証済みlocal build、PATH上のbinaryの順に解決する。配布版は同梱binary以外へfallbackしない。
- H.264の再encodeはmacOS標準のVideoToolbox encoderを使用し、外部codec libraryをbuild chainへ追加しない。
- FFprobeには30秒と1 MiBの上限を設ける。FFmpeg合成にも有限の実行時間と出力量上限を設け、timeoutまたは超過時はprocessを強制終了する。
- Electronはサポート中の最新stable major、Node.jsはそのminimum supported version以上を使用する。npm auditはproductionだけでなくdevelopment dependenciesも既知脆弱性0件をrelease gateとする。

## Consequences

- 実際に配布するmedia parserのversion、hash、CPU architectureをreleaseごとに再現・検査できます。
- 不正なprobe出力がmain processのmemoryを無制限に消費する経路を閉じます。
- release build時間はsource build分だけ増えます。CI cacheを導入する場合もsource hashとtarget architectureをcache keyへ含める必要があります。
- 現在の再現可能buildは配布対象であるmacOSに限定されます。他OSを正式配布する前に、同じ検証モデルのbuild targetを追加する必要があります。
- VideoToolboxによるH.264 encodingは従来のlibx264とbitrate特性が異なるため、書き出しE2Eで再生可能性と進捗を継続検証します。
- 配布物には各libraryのlicense noticeを含めます。source versionと取得先はbuild scriptを正本とします。
