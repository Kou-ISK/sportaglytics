# 0033 Windows desktop runtime

## Status

Accepted

## Date

2026-09-13

- Related: [0020](0020-verified-media-toolchain-and-process-containment.md), [0030](0030-video-window-aspect.md), [0012](0012-llm-model-artifact-distribution-boundary.md)

## Context

インストーラー設定だけではWindowsで映像書き出し・音声同期・AIを実行できない。macOS専用エンコーダー、OSフォント、Commandキー、file URL、ウィンドウAPIの差異も利用者の操作に影響する。開発PCに導入済みのDLLが不足を隠すため、起動確認だけでは配布可能性を判定できない。

## Decision

Windows 11 x64を明示的な配布対象とし、macOSと同じ機能モデル・View・保存形式を用いる。OS差分は共有のshortcut変換、Electron境界、ビルドスクリプトへ閉じ込める。

0020の検証済みソースビルドをWindowsへ拡張する。WindowsのH.264はOpenH264のソフトウェアエンコーダーを静的に組み込み、GPUやOSの追加メディア機能に依存しない。日本語フォントはOFLライセンスと共に同梱する。llama.cppも出典・SHA256を固定してWindows x64 CPU向けにビルドし、C++ランタイムを静的にリンクする。macOSもIntel / Apple Silicon別の公式アーカイブをSHA256とMach-O CPU種別で検証し、対応するruntimeを同梱する。アーキテクチャ不一致を防ぐため生成バイナリはgitで共有せずcacheへ置く。モデル重みの非同梱契約は0012に従う。

0030の映像部分の縦横比契約をWindowsでは `will-resize` で実現する。Windowsで無視される `setAspectRatio` のextraSizeに依存しない。プレイリストは引き続き固定対象外とする。

配布前にWindows上のソース品質ゲート、Electron E2E、ネイティブ依存DLL検査、インストール済みアプリのE2Eを行う。macOSの署名・公証とWindowsの署名は分離し、署名の有無を公開状態と一致させる。

## Consequences

利用者がFFmpegやVC++再頒布パッケージを別途導入する負担を減らせる。CPU向けAIは互換性を優先し、GPU向け追加runtimeを自動導入しない。ビルド時間とWindows CIの維持負担が増える。ネイティブARM版、Windows専用GPUモデル、model packの学習・配布は独立した判断が必要になる。
