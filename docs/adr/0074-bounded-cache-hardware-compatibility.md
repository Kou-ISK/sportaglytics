# 0074 Bounded cache hardware compatibility

## Status

Proposed

## Date

2026-10-24

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0073](0073-verified-playback-cache-foundation.md)

## Context

同じコピーの全尺HW再生を利用のたびに要求すると、内容proofを再利用しても準備時間が動画尺以上になる。全尺HW検査はその時の再生成功を観測するが、将来のGPU資源・製品UI・実音声品質を保証しない。全内容の対応証明と現在のデコーダー適合性は異なる保証である。

## Decision

初回生成は全内容・全尺HW検査を残す。再利用は全内容proofと現在の全hashを照合した後、毎回新しい隔離playerで先頭/中間/末尾を各2秒観測する。6秒以下は全体1区間とする。各区間はseekとは別の複数frame callbackとmediaTimeの前進、末尾はendedを要求する。全区間の単一VideoToolbox/platform player、error/fallback/観測切断なしを必要とする。

Mainがfullとcompatibilityを指定し、policyでモードと区間完了を検査する。compatibilityをfullのended証明へ昇格させない。30秒のmonotonic判定期限をawait後にも照合するが、取消・失敗時の所有Window終了/片付け待ちは打ち切らない。

内容proofだけをMain起動内LRUへ保持し、実bytes全hash・サイズ・recipe・runtime/tool hash・証明版へ結合する。変更・再起動・未登録時は全列を再計算する。永続manifestや過去のHW成功を現在のHW証拠としない。既存の所有者/容量/公開/採用前後の改変検知を維持する。

採用後のfatal media errorは共通時計を止め、同じ位置・全音声設定で原本への復帰を一度試みる。readiness/seek/audioを確認して初めて原本選択を通知する。成功・復旧未確認の両方を表示し、自動再生/自動再試行ループを避ける。

## Consequences

再利用のHW観測量は計画6秒（callback遅延を含む区間合計は7秒以内）で尺に依存しなくなる。一方、未観測区間のHW decodeを確認したとは言えず、非fatalなsoftware fallbackや滑らかさ・実音声同期・物理scrubの保証もない。全field/音声/時刻は別の全内容proofで確認し、fpsを下げない。

初回生成の全尺HW、cold全列解析、毎回の全hashは残る。長尺向けの永続proofと変更検知、容量、変換時間の設計は未完了で、120秒の対応上限を解除しない。全長変換・新権限・新依存・自動採用は導入しない。短尺製品IPCによる効果と失敗経路を別途確認し、コードの合格を実UI品質の合格としない。
