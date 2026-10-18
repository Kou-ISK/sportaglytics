# 0069 Timeline detection provenance

## Status

Accepted

Supersedes only the decision to discard detector identity on import in [0022](0022-verified-local-rugby-event-detection.md) and [0024](0024-experimental-event-detection-production-lane.md). Their existing superseding ADRs still govern model execution, private R&D and evaluation.

## Date

2026-10-18

## Context

通常Timelineへ候補を追加するとモデル・スコアの情報が失われ、保存再開や編集後に元候補と人の確認を区別できなかった。一方、作成元を推測して旧データを手動・人確認済みへ分類する根拠はない。モデルの品質status、申告評価値、候補スコアも人がその場面を確認した証拠ではない。

## Decision

- Timeline v2に任意の `provenance` を追加する。通常の編集・保存authority・Undoを使い、別AI Timelineやreview queueは作らない。
- 実際に返された検出resultのrun/model ID・model versionと、候補ID・種別・スコア・元代表時刻だけを記録する。ローカル映像パス、元映像、確認者情報、推測したモデルhashや評価値を加えない。
- 由来を記録した場面の `reviewStatus` は今回 `unreviewed` のみ。人確認の記録がないという意味で、実際の確認作業の有無を判定しない。再生・編集・追加・コピーを人確認の証拠として使わない。
- フィールドがない旧データ・手動追加・交換入力は由来/確認状態が不明のまま。既存候補を行名やスコアから推定して補完しない。不正な由来や未対応の確認状態は読込を拒否し、原本を変更しない。
- 元候補は現在の編集区間と分離する。分割・複製・内部コピー・Undo/Redoは由来を保持する。結合は元候補を重複除去してすべて残し、由来のない場面を含む場合は `hasUnknownSource` を保持する。
- 既存の場面検索の詳細で由来を展開できる。元候補スコアは編集後の区間の正確さでも精度でもないと示す。明示的な人確認workflowは、確認対象・変更時の失効・確認者/時刻の扱いを決めてから別途追加する。
- model versionは結果の識別子であり、学習済み重みの証明ではない。モデル権利・品質評価は既存の台帳とruntime条件を維持する。

## Consequences

追加依存や推論を伴わず、候補の来歴を失わずに通常編集できる。今回の変更は完全な人確認workflowではない。すべての場面を確認済みへ移行する機能もない。

対応版は旧配列とv2を読めるが、旧版が新メタデータを再保存時に落とす可能性がある。引継ぎは対応版でパッケージ全体を扱う。通常のTimeline配列JSONは任意メタデータを保持する。SCTimeline交換JSON・CSV・Playlistの形式は変更せず、これらは由来を保持する完全backupではないと明記する。将来human reviewを追加する場合は、旧版が新状態を認定せず拒否する点も踏まえて互換方針を決める。

合成候補による変換・validation・save/reopen・編集・merge・copy・Undo/Redo試験と、既存Electron検出E2Eの永続化assertionで検証する。モデル精度や人確認の正しさを検証したとは扱わない。
