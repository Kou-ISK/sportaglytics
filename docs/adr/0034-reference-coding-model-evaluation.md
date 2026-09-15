# 0034 Reference Coding Model Evaluation

## Status

Accepted

Supersedes [ADR 0024](0024-experimental-event-detection-production-lane.md).

## Date

2026-09-15

## Context

既存Codingと検出結果の不一致には、重複検出や実際の誤検出に加え、記録と対応しない実プレーが含まれます。チームを問わないイベント検出では、チーム情報の追加確認によってこの違いは解決しません。比較に使えるCodingがあっても、その網羅範囲が未確認なら一般的なPrecision/Recallの根拠にはできません。一方、比較値の意味を保った試験モデルとして改善候補を試すことはできます。

## Decision

- `verified` と `experimental` の区別、検証済みモデルの品質条件、runnerのハッシュ・パス・IPC・結果検証、タイムアウト・キャンセルはADR 0024から維持します。
- 既存schema 1はロード時に `evaluationBasis: reported-metrics` へ正規化し、従来の報告値を表示します。この値は新たな網羅性の認定ではありません。
- 比較専用packはschema 2 / `experimental` / `evaluationBasis: reference-coding`とします。組み合わせをmanifestとIPCで検証し、`verified`への偽装を拒否します。
- UIは比較専用packの値を「記録済みプレーの再検出」「Codingと一致した候補」と明記し、実際の検出精度と同一視しません。通常のTimelineで確認・修正する操作を維持します。
- R&D側は、比較完了、同じ試合・クラスの記録済みプレーの取りこぼし非増加、クラス別未対応候補の非増加、別途確認した実プレーの保持、集計と比率の整合、およびcheckpoint・threshold・走査設定の来歴を出力時に検証します。Codingの網羅範囲は未確認のまま保持し、全件確認済みへ書き換えません。
- 網羅性が未確認の古い評価レポートは、比較の根拠を持つschema 2レポートへ再評価・変換するまで出力しません。検証済みへの昇格には独立した完全な評価と作業時間削減の確認が必要です。

## Consequences

ユーザーが既に作ったCodingを使った改善候補を、値の意味を明示して試せます。schema 1しか知らない旧アプリはschema 2を拒否するため、比較値が通常の精度として誤表示されません。比較用モデルを使うには対応アプリが必要です。モデル更新時は旧packを読み込み対象外の場所へ退避し、バージョンとハッシュを記録して戻せる状態にします。モデル重みと私的な評価データはGitへ含めません。
