# 0071 Release-Time Model Selection

## Status

Accepted

## Date

2026-10-18

## Context

将来のアプリ配布で、その時点の最新モデルを取り込む要求がある。一方、最新のR&D exportや可変URLは配布許諾、全対象runtime、評価、再現性を保証しない。既存のローカルpack consumerと署名前provenance契約は維持し、v0.17.11をモデルなしで完了する必要がある。

## Decision

通常installer同梱を第一案とし、公開可能な候補台帳から人が承認した、アプリ版・全対象OS/arch・評価条件を満たす最新の版を決定的に選ぶ。app-to-model lockは正確なアプリ版、候補・証拠・target別入力hashを固定する。CIは古いlock、改変、未知契約で停止し、自動fallbackや自動承認を行わない。人の由来・権利・精度判断と機械の整合検査を分ける。

初期基盤は空catalogと明示的なnone lock、合成試験だけを持つ。実packの取得、target別staging、最終installerからの実推論、署名公証、Release証拠への結合は別段階で実装する。既存配布ゲートを緩和せず、私的モデルを公開しない。仕様と未実装範囲は[将来モデルの選定方針](../event-model-release-policy.md)、実装課題は[#243](https://github.com/Kou-ISK/sportaglytics/issues/243)へ記録する。

## Consequences

同じ公開metadataから同じ候補を選び、アプリ更新時にモデル採用を明示的にレビューできる。experimentalの候補確認とverifiedの主張を分け、hashの一致を許諾や精度の保証にしない。rollbackは旧Releaseの上書きではなく、新アプリ版で以前の検証済みpackまたはモデルなしへ戻す再検証付きの例外とする。schema 1はこの例外を拒否し、実同梱の前に実装する。[ADR 0061](0061-event-pack-distribution-provenance.md)を補完し、runtime consumerの互換を変更しない。
