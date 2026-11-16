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

decode要求の失効と完成済みsource画像の寿命を分ける。同じsourceの新しい再生意図で完成画像まで破棄せず、取消済みproducerの完了を新しい要求の結果として受理しない。画像のproducer識別子は表示操作の権限ではなく、実提示ACKは別のconsumer操作へ紐付ける。停止位置へのseekが完了しても、その位置の画像が取得できたとは扱わない。

実装の接続・失敗方針・段階的な受入条件は[設計](../multi-angle-playback.md)を正本とする。取得画像だけの測定を実表示としない。reverse方式の採用、既存ADRの置換、製品defaultの変更は、供給持続性と同一署名済み配布版の実機受入を根拠に決定する。

## Consequences

単一映像の仕様を維持しながら複数映像を移行できるが、既存の単一surface/owner、protocol、署名済みhelperの能力識別まで接続が必要になる。古いhelperや不明capabilityをgroup対応と推測しない。新しい部品の単体成功だけでは公開条件を満たさず、現在の公開版0.17.29の性能達成とも扱わない。
