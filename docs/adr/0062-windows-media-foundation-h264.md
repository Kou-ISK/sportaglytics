# 0062 Windows Media Foundation H.264

## Status

Accepted

## Date

2026-10-14

## Related ADRs

- Supersedes: [0033](0033-windows-desktop-runtime.md) のWindows H.264選択のみ。対象OS、フォント、AI、操作と配布検証の判断は継続する。
- Superseded by: N/A

## Context

従来はOpenH264をソースから静的リンクしていた。[Ciscoのbinary license](https://www.openh264.org/BINARY_LICENSE.txt)にある特許料カバーはCisco提供binaryの個別download等を条件とし、自前buildの同梱へ自動適用されると解釈できない。この点を改善するためにOS提供codecを選択する。過去の配布を違法と断定する判断ではない。

[FFmpeg公式](https://ffmpeg.org/ffmpeg-codecs.html#MediaFoundation)はソフトウェア/HW両方をサポートする。[固定8.1.2の実装](https://github.com/FFmpeg/FFmpeg/blob/n8.1.2/libavcodec/mfenc.c)はdesktopでmfplat.dllを動的に読み、[MFT選択](https://github.com/FFmpeg/FFmpeg/blob/n8.1.2/libavcodec/mf_utils.c)はHWを指定しなければ同期software MFTを列挙する。[Microsoft](https://learn.microsoft.com/en-us/windows/win32/medfound/h-264-video-encoder)のH.264 encoderはMain profileとNV12入力をサポートする。[Windows N](https://support.microsoft.com/en-us/windows/experience/platform-variants/media-feature-pack-for-windows-n)ではMedia Feature Packが必要になる。

## Decision

Windows x64のFFmpegにMedia Foundationを明示的に有効化し、OpenH264のbuild/sourceを除く。自動検出を無効にした8.1.2のbuildではmfencの型定義にD3D11VAも明示的に有効化する。これはbuild要件であり、実行時のGPU選択とは分離する。H.264は `h264_mf -hw_encoding 0 -b:v 5M -profile:v main -pix_fmt nv12` を共通設定とする。NV12は入力形式で、MP4内のH.264 4:2:0互換性を維持する。captureのbitrate/GOP指定は維持する。GPU、vendor driver、外部codecのdownloadは不要で、OS DLLを再配布しない。macOSのVideoToolbox、署名、公証の判断は変更しない。

encoder一覧だけではOSの利用可否を判定できないため、再符号化の直前に小さい合成映像3フレームをCPUで符号化し、timeoutと出力量を制限する。成功と進行中の検査は実行ファイル単位で共有し、失敗は再試行できる。失敗時はWindows NのFeature Pack導入・再起動と通常版の修復案内を表示する。captureは入力開始・package作成より前に検査する。stream copyやdecodeだけにencoderを要求しない。

## Consequences

Windows Nの追加機能不要という従来契約は変わる。OS機能の追加を自動実行せず、不足を明示する。source bundle、notice、cache identityを同じrecipeへ揃える。旧版の告知とsource補足は維持する。OS codecの採用を個々の利用に対する包括的な特許許諾保証とは扱わない。

Windows CIでGPU無効指定の720p/1080p/3840×1080二画面相当のMP4を復号し、フレーム数・音声時刻・尺を検査する。既存の同期、overlay、二画面、結合、captureの実Electron検査を維持し、installed E2Eも全22シナリオへ揃える。Windows Nの不足状態はunitで模擬し、実OSでのFeature Pack未導入/導入後の確認は別の実機検証として記録する。
