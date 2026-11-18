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

The subsequent read-only pixel comparison matched nine AVPlayer buffers to independently decoded active NV12 pixels. The paused baseline matched its source PTS; all eight negative-rate observations had a different display deadline (including deadlines equal to a _different_ real sample start). The movie-time attachment merely repeated the display deadline and was not independent source provenance. At that intermediate checkpoint the experimental placed-pair Host rejected negative playing controls as `unsupported-reverse-provenance`, pauses/drains, and the source adapter also refuses negative scheduling. The synthetic Host re-press test uses positive-rate controls and separately verifies the negative-rate rejection. Legacy v1 controls are unchanged. A timestamped reverse producer remains required; this guard is not a reverse performance improvement or completed product connection.

## Timestamped decoded-window decision

The metadata-only index is superseded by DecodedFrameWindow. Decode callback identity is tied to the compressed CMSampleBuffer's exact PTS/duration; AVPlayer display deadlines and movie-time attachments do not establish source provenance. Main's validated file revision is propagated, checked at read/adoption/cache boundaries, and ordinary replacement fails without publishing pixels. Per-owner requests, two global workers, packet/image/time bounds and shared image loans limit retained work; decoder/OS/GPU internals and unresponsive SDK cancellation are outside that bound. AVPlayer remains audio-only in this experimental group path. The legacy single-player path is preserved. Normal Controller capability remains gated pending sustained supply and display acceptance. The later experimental Host activation is described below.

The compressed reader's start is selected from a bounded AVSampleCursor full-sync search rather than unconditional half-second padding. This avoids starting one GOP too early without skipping dependency packets or changing requested/sample time. Unsupported metadata uses the old conservative anchor; cancellation, exact timestamp checks and physical drain remain mandatory. A producer-only ABBA comparison demonstrates position-specific latency reduction, not normal Controller or display acceptance.

Audio preparation/seek and timestamped image-window preparation are independent, with a joint ready barrier. Starting the bounded reader must not wait for AVPlayer readiness; exposing the source image still requires successful real audio positioning. This permits overlap without treating pending audio as ready or cancelling unacknowledged seeks synthetically.

## Experimental host clock and bounded prefetch

Use two immutable half-second decoded banks per source, sharing one 512 MiB retained-image/loan budget. Adjacent prefetch overlaps consumption without retaining the entire media or claiming a decoder/GPU memory cap. A common host clock is separate from audio time, source sample time and complete-pair Drawn time. Negative playback keeps audio paused. On a coverage deficit, pause at the last complete Drawn pair and wait for one fixed target; resume only after that target is acknowledged. New controls revoke pending resume. Do not advance a clock over a frozen image or treat partial acknowledgement as a synchronized pair.

The synthetic real-Host regression covers all four reverse rates across bank boundaries and physical drain, but its Drawn is mocked. Heavy-source runs demonstrate correct bounded buffering and stopping, with substantial gaps and insufficient sustained throughput. Consequently this decision does not enable the normal Controller, replace ADR 0081, establish screen/audio acceptance, or change this ADR's Proposed status. Further GOP reuse/resource design and signed product integration remain necessary.

## Preserve clock authority through ordinary session recovery

A Main-qualified group session uses complete-pair Drawn history as its observation authority. Late directional acknowledgements while buffering differ from a paused AVPlayer source clock and require the exact ledger evidence; ordinary source-clock semantics remain unchanged. A drained group returns a separately tagged presentation receipt, checked against issued operations and actual drainage before Controller recovery. It must never fabricate the existing stopped-source-clock receipt. Test adapters connect the ordinary Controller and Main session to the actual Host, but normal provider/capability/UI and signed acceptance remain outstanding.

A release fence belongs to preload's actual complete-pair presenter, not a requested Controller time. Controller synchronously freezes it before awaiting its serialized writer, preserves a bounded stop barrier before re-press, and allows an explicit newer seek to supersede an unsent stop. Main validates the typed receipt against its own ledger before translation to Host proof. This prevents command-queue delay from moving the release anchor, without claiming cancellation of already submitted Canvas work or enabling group selection in the default provider.

Buffering output pause and explicit user stop are separate source operations. A coverage deficit retains decode direction for its fixed pending target while pausing audio/common-clock output; user pause, seek and close continue to revoke new prefetch. Only one adjacent bank is allowed at that target. A peak charged-image counter observes the existing byte budget without extending it or claiming OS memory reservation. Larger decode-bank experiments did not establish acceptable pair cadence and do not change the default half-second plan.

The Main-qualified group presentation supplies reverse rates to Controller gesture eligibility; the audio-only AVPlayer's capability is not the group decoder's authority. Availability tags that distinction only with a validated presentation scope. The Manager must preserve the backend's ledger verifiers. Both command writers retain a bounded fenced-stop barrier before re-press, while a newer explicit seek may replace an unsent stop. A one-port gateway must reject group availability until pair binding and two-port recovery are connected; this metadata does not establish signed-helper capability by itself.

Group protocol capability is an explicit fixed helper query after signed-set/hash verification, independently of export revision/capabilities. It describes bounded ABI scope rather than source fitness or cadence. Unknown declarations fail closed; finite termination requests never fabricate process drainage. Keep the legacy provider active until the two-port recovery, pair surface bindings and signed product acceptance are connected.

Compose group process/storage/transfer lifecycle in a Main-only backend, separately from source qualification and Renderer controls. A physical termination proof may authorize resource drainage after an abnormal child result; it cannot authorize recovery success. Validate group receipt and charged-image release before removing only the owned session. Preserve original errors if activity cleanup also fails. This composition alone does not change default provider selection or qualify a signed paired UI.

Main-driven close must not depend on a future Renderer animation frame. Use one scoped group drain notification to dispose pending imports without Drawn acknowledgement and fence that generation against later controls. Keep the actual transfer/GPU-release and child/native drain barriers; a notification cannot fabricate resource release. Stale document/generation notifications are ignored so old cleanup cannot close a new playback owner.

Main group admission uses a separate typed selection endpoint so a Renderer cannot reinterpret a one-source grant as two angles. Package IDs are resolved by Main; signed helper capability, current source identities and the placed-pair profile precede any playback factory. Same-URL slots retain separate angle/clip identity and one explicit audio owner. Only idle qualification may be replaced: switching selection is not a drain/recovery mechanism. Packaged startup supports this admission; unsigned preview and unknown helpers do not silently downgrade signature policy. Full ordinary paired UI/recovery and clip/gap behavior remain prerequisites for default activation. The returned placement grid follows the Host's 120000 ticks rather than introducing a second offset model.

## Restricted ordinary pair composition

Connect an explicit paired boundary rather than removing the single-player exclusion. The initial admissible timeline must have two complete-package local clips with matching canonical coverage. Preserve slot/clip identity even for equal URLs and select exactly one audio owner. Both actual canvases must be registered before any group open; their binding is distinct from the legacy single-source binding. Treat the Main binding as package-global clock authority only while current sources, clips and placements match.

Recovery waits for native drainage and both independently mapped original-player images, retaining authority if either fails. Listener cancellation cannot cancel an issued browser seek. Static original ports cannot safely recover into other clips or gaps, so those timelines remain unsupported by this gateway pending a separate preparation transaction. This bounded connection advances ordinary integration but does not change this ADR's Proposed status or claim sustained reverse, signed display, audio or general timeline acceptance.

A complete Drawn pair at the exact initial target may precede the initial audio-ready paused observation. In drawn-pair mode only, a separately ledger-confirmed buffering observation for that issued seek may establish its image baseline. It does not mark audio/video ready. In drawn-pair mode, lastConfirmedTime follows this separately ledger-confirmed visible image even during buffering, so tagging describes the displayed position. Source-clock mode still requires an actual ready observation. The Renderer requires the buffered snapshot clock to equal that confirmed image time; it does not reset readiness deadlines. A missing/foreign pair, an off-target first image or a source-clock buffering observation cannot establish this anchor. This handles an initial reverse command while audio is still preparing without pretending delivery is readiness.


A paused preparing/settings ACK may be newer than the complete image referenced by an accepted release fence. Main retains at most that fence's issued image intent across ACK pruning, in addition to unacknowledged commands. A physically drained close may use that older receipt only when it exactly matches the delivered stop fence, the current intent remains paused in the same seek, and the existing Main ledger, range and direction checks pass. A new issued play/seek clears the retained reference; failed/uncertain delivery cannot grant the older-receipt exception. This metadata retention grants no native/GPU drainage or audio-readiness proof.


New automatic pair qualification/open waits for a visible document. Real paired imports may already exist while an occluded/hidden window's animation-frame scheduler is stopped; starting a new group there otherwise consumes the initial presentation deadline without a submitted pair. Visibility changes revoke only that pending admission and permit a later visible attempt; they do not manufacture Drawn, cancel an issued browser seek, change the existing active-session/drain contract, or block background export/other command work. No background-throttling or OS/security setting is changed.


If a newly opened pair becomes hidden before its first complete presentation, request normal drainage and two-port original recovery instead of waiting for a throttled animation-frame callback. A later visible attempt needs confirmed recovery and fresh Main qualification; a failed/uncertain recovery retains its lease and cannot auto-retry. This exception does not reinterpret an already presented session as unstarted or change its existing close/failure contract.

A physically drained, ledger-confirmed group stop also takes precedence over an unacknowledged initial audio seek during original-player recovery. Otherwise a pair displayed while audio was preparing could return to the requested start instead of the visible stopped image. Explicit newer user seeks still take priority; legacy source-clock recovery is unchanged.
