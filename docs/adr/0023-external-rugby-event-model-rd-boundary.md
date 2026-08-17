# 0023 External Rugby Event Model R&D Boundary

## Status

Accepted

## Date

2026-08-18

## Related ADRs

- Supersedes: [0022 Verified Local Rugby Event Detection](0022-verified-local-rugby-event-detection.md)
- Extends: [0002 Typed Electron IPC and Renderer Gateways](0002-typed-electron-ipc-and-renderer-gateways.md)
- Extends: [0020 Verified Media Toolchain and Process Containment](0020-verified-media-toolchain-and-process-containment.md)

## Context

SporTagLyticsの自動イベント検出には、二つの異なる責務がある。

1. 製品側: verified model packを安全に実行し、検出候補を通常Timelineへ追加する。
2. R&D側: dataset preparation、fine-tuning、hard-negative mining、threshold/NMS探索、benchmark、qualification、model exportを行う。

これらは目的、依存関係、release cycle、privacy riskが異なる。R&DはPython/PyTorch系のheavy dependency、privateな試合映像・Coding、実験artifactを扱う一方、SporTagLytics本体はElectron/TypeScriptのlocal-first applicationであり、一般ユーザーへ配布するruntimeだけを安定して保つ必要がある。

また実際のCoding workflowでは、高Precisionで一部だけ自動作成するより、**イベントをほぼ全件候補として出し、人間が不要候補を削除する**方が作業しやすい。したがってモデル採用判断はPrecision単独ではなく、高Recall operating pointでのfalse positive数、処理時間、実際の編集操作削減を重視する必要がある。

## Decision

- SporTagLytics public repositoryは**event detection consumer**とする。保持するのはUI、IPC、verified model discovery、runner process containment、Model Pack contract、Timeline変換、Undo/重複除去など製品runtimeに必要な実装だけとする。
- dataset preparation、training、fine-tuning、hard-negative mining、model family比較、threshold/NMS/stride探索、benchmark、qualification、model export、private diagnosticsは**別のprivate R&D repository**で管理する。
- private R&D repositoryの具体名や学習元をSporTagLytics public repositoryのruntime contractに埋め込まない。製品側はmodel packの互換schemaとverification情報だけを知る。
- 元動画、`.stpkg`、Timeline Coding、frames、checkpoints、runs等のdataset/artifactはGit repositoryへcommitしない。ローカルprivate storageを基本とし、将来共有が必要な場合だけprivate object storageを使用する。
- 一般ユーザーの端末で自動fine-tuningする仕組みは初期製品に入れない。ユーザーごとに品質・計算時間・再現性が変わるため、SporTagLyticsは共通のverified model packを利用する。
- ユーザーデータをモデル改善へ利用する場合は将来の明示的opt-in設計とし、暗黙収集・自動uploadを行わない。
- runtime quality gateは**Recall優先**とする。classごとにRecall >= 0.95かつmatch-level unseen evaluation >= 5を最低条件とし、Precisionは0〜1の有限値として記録するが固定の最低Precision値はruntime promotion gateにしない。
- private qualificationでは少なくとも次を確認し、実作業を減らせないmodelは`verified`へ昇格しない。
  - Recall 95% / 98% / 99%近傍でのPrecision
  - false positives per match
  - missed events per match
  - wall-clock inference time / video minute
  - 削除・追加を含む推定または実測のmanual edit operations
  - 通常の手Codingと比較した作業時間削減
- 秒単位の厳密なevent onsetは製品の主目的にしない。Codingされた妥当なイベント区間を発見できることを優先する。
- runner executableは引き続きmodel pack内に置き、platform/architectureごとのrelative pathとSHA-256をmanifestへ保存する。main processはpath traversal、存在、hash、payloadを検証し、`shell: false`、finite timeout、cancel、output/stderr capを維持する。
- detector resultは通常の`TimelineData`へ変換し、自動検出専用の永続データモデルを作らない。同一runは1回のstate updateで追加し、1回のUndoで戻せるようにする。

## Consequences

- SporTagLytics本体のCIからPython research dependencyを外せる。
- モデル改善はアプリversionと独立して進められ、model packだけを更新できる。
- private dataset名、試合名、source path等がpublic repositoryへ混入する機会を減らせる。
- R&D repository側には独立したCI、privacy rule、dataset split lock、model qualification policyが必要になる。
- public repositoryだけではmodelの再学習はできなくなるが、これは意図した境界である。
- 既存Git履歴の書き換えは本ADRの対象外とし、現在のtreeからprivate source-identifying informationを除去した状態を維持する。
