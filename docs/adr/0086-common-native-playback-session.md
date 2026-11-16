# 0086 Common native playback session

## Status

Proposed

現在の[0081](0081-held-reverse-presentation.md)をこの段階では置換しない。方式選定と実機受入後に、採用する責務とsupersessionの範囲を確定する。

## Date

2026-11-16

## Context

現native経路は単一angle/clip/offset0に結び付いている。単一条件を除くだけでは複数時計、surfaceの取り合い、音声重複を作る。公開されているSportscodeの説明はAppleの動画基盤と多angle対応までで、内部のplayer数やreverse方式を示さない。

非GUIの実AVPlayer対照では、共通hostによる2系統の取得開始は揃えられたが、reverse capabilityがtrueでも低倍率の画像密度は不足した。実原本では時計と取得PTSが大きく離れた。短区間reader cacheは全sampleを保てた一方、原本でのreader再初期化費は供給持続性の障害になる。時計同期と実表示の問題を同一視できない。

## Decision

単一/複数共通のpackageセッション、angle別source/surface、既存mediaTimelineによる時刻写像を設計する。通常再生は映像別AVPlayerと共通host clockを第一候補とし、reverseは実PTSと表示結果から有界cache/描画方式を比較する。毎フレームのJS経由seek、全尺変換、当然の画質低下を基本方式にしない。

まずbufferの所有・上限・操作/source世代をportable native部品へ分離する。cache eviction後もconsumerが借用するimageは同じ保持budgetに残し、遅い完了を新媒体へpublishしない。保持budgetをOS全体のメモリ予約と呼ばない。

lease/予算はcacheとtransportの共通資源層へ置く。cacheがtransportを内包せず、SurfaceSenderが同じ型のleaseをReleased ACKまで持つことで所有を接続する。画像と無関係な予算ownerの組をAPIで渡さない。既存のsource/control検査、credit、GPU参照終了待ちをこのleaseで代行したとは扱わない。

decode要求の失効と完成済みsource画像の寿命を分ける。同じsourceの新しい再生意図で完成画像まで破棄せず、取消済みproducerの完了を新しい要求の結果として受理しない。画像のproducer識別子は表示操作の権限ではなく、実提示ACKは別のconsumer操作へ紐付ける。停止位置へのseekが完了しても、その位置の画像が取得できたとは扱わない。

実装の接続・失敗方針・段階的な受入条件は[設計](../multi-angle-playback.md)を正本とする。取得画像だけの測定を実表示としない。reverse方式の採用、既存ADRの置換、製品defaultの変更は、供給持続性と同一署名済み配布版の実機受入を根拠に決定する。

## Consequences

単一映像の仕様を維持しながら複数映像を移行できるが、既存の単一surface/owner、protocol、署名済みhelperの能力識別まで接続が必要になる。古いhelperや不明capabilityをgroup対応と推測しない。新しい部品の単体成功だけでは公開条件を満たさず、現在の公開版0.17.29の性能達成とも扱わない。

転送はv1から分離したgroup v2とし、異なるsource PTSを共通anchorへMainで検査する。preloadのglobal texture receiverは増設せず分岐し、pair両側の取得後に描画する。Renderer handle権限を増やさず、未確認releaseを予算へ戻さない。これは転送/提示段階の決定で、Host制御・継続供給・署名版受入前のProposed状態を維持する。

複数sourceのimage intervalは、AVPlayer outputが返したPTSと圧縮trackの実sample metadataを照合する。平均fpsや目標時計で有効区間を捏造しない。metadataの期限失効と実worker排出を分け、取消/期限をreader終了の証拠にしない。限定された転送形式の一般化やgroup Hostの有効化は、このmetadata部品の追加だけで承認したとは扱わない。

限定placed-pair Hostを既存helperのversion 2 manifest入口へ追加する。source取得/metadata・pair barrier/音声所有・process/controlを別ファイルとし、Mainで検証済みの二clipの共通有効区間だけを対象にする。制御operationと物理seek世代を分離し、再押下で初期targetへ巻き戻さない。解除はprompt pauseとnative発行pairのproof照合を分け、画像anchorを停止player clockに流用しない。通常provider/capability/Controllerとclip切替・持続reverseは未接続のため、group利用のdefault変更やProposedからの状態変更は行わない。

### Display deadlines are not source-sample provenance

[Apple's API definition](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput/copypixelbuffer%28foritemtime%3Aitemtimefordisplay%3A%29) and the SDK AVPlayerItemOutput.h define outItemTimeForDisplay as a display deadline, not an invariant original compressed-sample PTS. The heavy-source placed-pair run returned a deadline absent from its actual packet table; the strict metadata lookup rejected it. This is not a memory or Mach drainage failure. Do not hide it with a nearest-sample tolerance or relabel a held image.

SourceSampleIntervals contains real compressed-sample metadata. Equality of a candidate AVPlayer deadline with a sample start is a restrictive experimental gate, not general proof of pixel provenance. The Host mode is therefore explicitly placed-pair-deadline-experiment; it is not advertised as a production capability and normal provider/Controller activation remains disconnected. A timestamped pixel producer (for example a bounded reader/decoder cache), or a separately justified presentation contract, is still required. Earlier AVPlayer acquisition-time observations are not original-sample or physical-display evidence.

The synthetic fixture now has distinct content per sample, and receiver-side pixels are checked as well as timestamps. Repeating two unchanged sample starts at different anchors does not count as a new image. These tests still do not prove full real-media content, different-camera synchronization, speaker output or signed-distribution acceptance.

The subsequent read-only pixel comparison matched nine AVPlayer buffers to independently decoded active NV12 pixels. The paused baseline matched its source PTS; all eight negative-rate observations had a different display deadline (including deadlines equal to a _different_ real sample start). The movie-time attachment merely repeated the display deadline and was not independent source provenance. Therefore the experimental placed-pair Host now rejects negative playing controls as `unsupported-reverse-provenance`, pauses/drains, and the source adapter also refuses negative scheduling. The synthetic Host re-press test uses positive-rate controls and separately verifies the negative-rate rejection. Legacy v1 controls are unchanged. A timestamped reverse producer remains required; this guard is not a reverse performance improvement or completed product connection.

## Timestamped decoded-window decision

The metadata-only index is superseded by DecodedFrameWindow. Decode callback identity is tied to the compressed CMSampleBuffer's exact PTS/duration; AVPlayer display deadlines and movie-time attachments do not establish source provenance. Main's validated file revision is propagated, checked at read/adoption/cache boundaries, and ordinary replacement fails without publishing pixels. Per-owner requests, two global workers, packet/image/time bounds and shared image loans limit retained work; decoder/OS/GPU internals and unresponsive SDK cancellation are outside that bound. AVPlayer remains audio-only in this experimental group path. The legacy single-player path is preserved. Negative-rate activation and normal Controller capability remain gated pending sustained supply and display acceptance.
