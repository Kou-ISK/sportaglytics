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

ローカル映像の自動音声同期は従来、先頭付近の固定20秒と ±30秒の探索範囲を前提としていた。この制約では収録開始位置が数十秒から数分離れた映像を探索できず、先頭が無音・BGM・起動ノイズの場合にも誤った peak を採用しやすい。さらに低 confidence を警告するだけで offset を適用すると、手動で正しく合わせた配置を自動解析が悪化させる可能性がある。

## Decision

- 各クリップの `timelineStartSeconds` を共通タイムライン上の絶対開始位置の正本とする。`durationSeconds` はローカル映像の probe または YouTube プレイヤー準備後の値とする。
- `gapBeforeSeconds` は後方互換フィールドとして残し、開始位置と直前クリップの終了位置から導出する。旧形式はロード時にクリップ順・gap・取得済みdurationから復元する。legacy project folder 自体は書き換えず、ADR 0006 の `.stpkg` migration 後の copy に対してのみ現行 config migration を適用する。
- パッケージ作成時は映像登録と順序だけを扱う。クリップ配置は再生画面のシンクモードで基準位置と対象位置から計算する。
- ローカルアングルは元クリップを再生単位として保持し、再生時に `timelineStartSeconds` から現在のクリップとクリップ内時刻を解決する。空白区間ではプレイヤーを外し、黒画面・無音を表示する。同期適用はconfigの配置情報だけを原子的に更新し、再生用映像を生成・置換しない。
- クリップ書き出しで連続した入力映像が必要な場合だけ、元クリップと配置情報からOSの一時領域へ合成する。一時映像は書き出し終了時に削除し、パッケージ内へ保存しない。
- 同一アングル内の重複、負数、非有限値、24時間を超える開始位置を拒否する。
- ローカル映像の自動音声同期は固定 ±30秒を既定探索範囲にしない。両音声の長さから成立し得る overlap を求め、低レートの正規化 energy feature で broad search を行う。候補は Top-K を保持し、十分な energy と変化量を持つ複数 window の一致を確認してから raw PCM の局所相関で refine する。
- ローカル自動同期の confidence は best peak だけでなく second-best peak との差、複数 window の consistency、usable window 数、raw refine correlation を組み合わせる。confidence が 0.35 未満、または非有限 offset の場合は現在の同期値を変更せず、手動同期を維持する。
- broad search は一定件数ごとに event loop へ制御を返し、progress は単調増加させる。全 duration の raw PCM を sample-level で総当たりしない。
- YouTubeの音声補正はダウンロード、ストリームURL解決、一時音声ファイルを行わない。macOS 13以降で、明示的なユーザー操作から表示中のプレイヤー音声を15秒だけloopback captureし、PCM解析後にメモリから破棄する。信頼度0.35未満は配置を変更しない。
- loopback captureが拒否または利用不能な環境では、クリップ単位の手動配置を維持する。

## Consequences

- Aが0–60秒、Bが600–720秒に配置された場合、60–600秒は再生時に540秒の黒画面・無音として扱われる。パッケージ内に540秒分の映像は生成されない。
- 数十秒〜数分の収録開始差や先頭無音があっても、探索空間に正解 offset を含められる。
- broad search の計算量は低レート feature に依存し、sample-level 探索は候補近傍に限定される。
- 低 confidence の自動結果は既存の手動同期を上書きしない。
- 同期責務がシンクモードへ集まり、作成ウィザードの認知負荷が下がる。
- ローカル映像の配置変更はconfig更新だけで完了し、再エンコードを伴わない。書き出し時間は必要に応じた一時合成分だけ増える。
- YouTube音声補正は完全自動同期ではなく、手動配置の精密補正である。OS権限、外部音声の混入、広告、埋め込み可否、YouTubeポリシーの影響を受ける。
