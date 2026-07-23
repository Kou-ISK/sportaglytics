# 0015 Clip timeline placement and audio-assisted sync

## Status

Accepted

## Date

2026-07-23

## Related ADRs

- Supersedes: [0013 Multi-angle media source model](0013-multi-angle-media-source-model.md)
- Superseded by: N/A

## Context

ADR 0013 は複数クリップの同期をパッケージ作成時の `gapBeforeSeconds` で決め、YouTube アングルを1 URLに限定した。この方式では、収録断片ごとに離れた共通時刻へ配置する操作が作成ウィザードへ混入し、映像を見ながら合わせるシンクモードと責務が重複する。また YouTube IFrame API は音声波形を公開しないため、URLから音声を直接取得せずに精密補正する境界が必要である。

## Decision

- 各クリップの `timelineStartSeconds` を共通タイムライン上の絶対開始位置の正本とする。`durationSeconds` はローカル映像の probe または YouTube プレイヤー準備後の値とする。
- `gapBeforeSeconds` は後方互換フィールドとして残し、開始位置と直前クリップの終了位置から導出する。旧形式はロード時にクリップ順・gap・取得済みdurationから復元し、保存操作までは書き換えない。
- パッケージ作成時は映像登録と順序だけを扱う。クリップ配置は再生画面のシンクモードで基準位置と対象位置から計算する。
- ローカルアングルは適用時に元クリップから再合成し、空白を黒画面・無音で埋める。出力とconfigは一時ファイルを使い、失敗時は従来ファイルへ戻す。
- 同一アングル内の重複、負数、非有限値、24時間を超える開始位置を拒否する。
- YouTubeの音声補正はダウンロード、ストリームURL解決、一時音声ファイルを行わない。macOS 13以降で、明示的なユーザー操作から表示中のプレイヤー音声を15秒だけloopback captureし、PCM解析後にメモリから破棄する。信頼度0.35未満は配置を変更しない。
- loopback captureが拒否または利用不能な環境では、クリップ単位の手動配置を維持する。

## Consequences

- Aが0–60秒、Bが600–720秒に配置された場合、Bの前には540秒の黒画面・無音が生成される。
- 同期責務がシンクモードへ集まり、作成ウィザードの認知負荷が下がる。
- ローカル映像の配置変更は再エンコードを伴う。元クリップは保持され、失敗時に既存再生映像を失わない。
- YouTube音声補正は完全自動同期ではなく、手動配置の精密補正である。OS権限、外部音声の混入、広告、埋め込み可否、YouTubeポリシーの影響を受ける。
